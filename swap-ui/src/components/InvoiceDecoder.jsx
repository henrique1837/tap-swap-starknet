import React, { useState, useEffect } from 'react';
import { decode } from 'light-bolt11-decoder';
import { Buffer } from 'buffer';

const normalizeHex = (hex) => (hex || '').replace(/^0x/, '').toLowerCase();
const hexToBase64Bytes32 = (hex) => {
    const normalized = normalizeHex(hex);
    if (!/^[0-9a-f]{64}$/i.test(normalized)) return '';
    return Buffer.from(normalized, 'hex').toString('base64');
};
const toBase64Url = (base64) => (base64 || '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
const toBase64Std = (value) => {
    const normalized = (value || '').replace(/-/g, '+').replace(/_/g, '/');
    if (!normalized) return '';
    return normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
};
const isValidBytes32Base64 = (value) => {
    try {
        return Buffer.from(toBase64Std(value), 'base64').length === 32;
    } catch {
        return false;
    }
};
const buildAssetIdEncodingCandidates = (hex) => {
    const base64Std = hexToBase64Bytes32(hex);
    if (!base64Std) return [];
    const base64Url = toBase64Url(base64Std);
    const base64StdUnpadded = base64Std.replace(/=+$/g, '');
    return Array.from(new Set([base64Std, base64StdUnpadded, base64Url]))
        .filter((candidate) => isValidBytes32Base64(candidate));
};
const bytesToHex = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const raw = value.startsWith('0x') ? value.slice(2) : value;
        if (/^[0-9a-fA-F]+$/.test(raw)) return raw.toLowerCase();
        try {
            return Buffer.from(value, 'base64').toString('hex').toLowerCase();
        } catch {
            return '';
        }
    }
    if (value instanceof Uint8Array || Array.isArray(value)) {
        return Buffer.from(value).toString('hex').toLowerCase();
    }
    if (typeof value === 'object') {
        const numericValues = Object.keys(value)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => value[key]);
        if (numericValues.length > 0) {
            return Buffer.from(numericValues).toString('hex').toLowerCase();
        }
    }
    return '';
};

function InvoiceDecoder({ invoice, title = "Invoice Details", lncClient, assetId }) {
    const [decodedInvoice, setDecodedInvoice] = useState(null);
    const [decodedAssetInvoice, setDecodedAssetInvoice] = useState(null);
    const [resolvedAssetMetadata, setResolvedAssetMetadata] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const decodeInvoice = async () => {
            if (!invoice || invoice.trim() === '') {
                if (!isMounted) return;
                setDecodedInvoice(null);
                setDecodedAssetInvoice(null);
                setResolvedAssetMetadata(null);
                setError(null);
                return;
            }

            try {
                const decoded = decode(invoice);
                if (!isMounted) return;
                setDecodedInvoice(decoded);
                setError(null);
            } catch (err) {
                console.error('Error decoding invoice:', err);
                if (!isMounted) return;
                setError('Invalid Lightning invoice format');
                setDecodedInvoice(null);
                setDecodedAssetInvoice(null);
                setResolvedAssetMetadata(null);
                return;
            }

            if (!lncClient?.tapd?.tapChannels?.decodeAssetPayReq) {
                if (!isMounted) return;
                setDecodedAssetInvoice(null);
                setResolvedAssetMetadata(null);
                return;
            }
            const candidateId = normalizeHex(assetId || '');
            if (!candidateId) {
                if (!isMounted) return;
                setDecodedAssetInvoice(null);
                setResolvedAssetMetadata(null);
                return;
            }

            const assetIdCandidates = buildAssetIdEncodingCandidates(candidateId);
            if (assetIdCandidates.length === 0) {
                if (!isMounted) return;
                setDecodedAssetInvoice(null);
                setResolvedAssetMetadata(null);
                return;
            }

            let parsedAssetInvoice = null;
            for (const encodedAssetId of assetIdCandidates) {
                console.log(encodedAssetId)
                try {
                    const response = await lncClient.tapd.tapChannels.decodeAssetPayReq({
                        assetId: encodedAssetId,
                        payReqString: invoice.trim(),
                    });
                    console.log(response)
                    parsedAssetInvoice = response;
                    break;
                } catch {
                    // Try next normalized bytes32 string candidate.
                }
            }

            if (!isMounted) return;
            setDecodedAssetInvoice(parsedAssetInvoice);

            let metadata = null;
            if (lncClient?.tapd?.taprootAssets?.listAssets) {
                try {
                    const listAssetsResponse = await lncClient.tapd.taprootAssets.listAssets({
                        withWitness: false,
                        includeLeased: true,
                        scriptKeyType: { allTypes: true },
                    });
                    const matchedAsset = (listAssetsResponse?.assets || []).find((walletAsset) => (
                        normalizeHex(bytesToHex(walletAsset?.assetGenesis?.assetId)) === candidateId
                    ));
                    if (matchedAsset) {
                        metadata = {
                            name: matchedAsset?.assetGenesis?.name || null,
                            assetType: matchedAsset?.assetGenesis?.assetType || null,
                            scriptKeyType: matchedAsset?.scriptKeyType || null,
                        };
                    }
                } catch (lookupErr) {
                    console.warn('Unable to resolve Taproot Asset metadata by assetId:', lookupErr);
                }
            }

            if (!isMounted) return;
            setResolvedAssetMetadata(metadata);
        };

        decodeInvoice();

        return () => {
            isMounted = false;
        };
    }, [invoice, lncClient, assetId]);

    const getTagValue = (sections, tagName) => {
        const section = sections.find(s => s.name === tagName);
        return section?.value || null;
    };

    const formatSats = (millisats) => {
        if (!millisats) return '0';
        const sats = Math.floor(millisats / 1000);
        return sats.toLocaleString();
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    };

    const formatAssetAmount = (amount, decimals) => {
        if (!amount) return '0';
        if (!Number.isInteger(decimals) || decimals <= 0) return amount.toString();
        const raw = amount.toString().replace(/^0+/, '') || '0';
        if (raw.length <= decimals) {
            return `0.${raw.padStart(decimals, '0')}`;
        }
        return `${raw.slice(0, raw.length - decimals)}.${raw.slice(raw.length - decimals)}`;
    };

    if (!invoice || invoice.trim() === '') {
        return null;
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-semibold">⚠️ {error}</p>
            </div>
        );
    }

    if (!decodedInvoice) {
        return null;
    }

    // Extract data from sections
    const paymentHash = getTagValue(decodedInvoice.sections, 'payment_hash');
    const description = getTagValue(decodedInvoice.sections, 'description');
    const expiry = getTagValue(decodedInvoice.sections, 'expiry');
    const payeeNode = getTagValue(decodedInvoice.sections, 'payee_node_key');
    const timestamp = getTagValue(decodedInvoice.sections, 'timestamp');
    const amountMillisats = getTagValue(decodedInvoice.sections, 'amount');
    const assetAmount = decodedAssetInvoice?.assetAmount;
    const assetName = resolvedAssetMetadata?.name
        || decodedAssetInvoice?.genesisInfo?.name
        || 'Taproot Asset';
    const assetType = resolvedAssetMetadata?.assetType || decodedAssetInvoice?.genesisInfo?.assetType || '';
    const scriptKeyType = resolvedAssetMetadata?.scriptKeyType || '';
    const assetDecimals = decodedAssetInvoice?.decimalDisplay?.decimalDisplay;
    const assetIdHex = bytesToHex(decodedAssetInvoice?.genesisInfo?.assetId) || normalizeHex(assetId || '');

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5 space-y-4">
            <h3 className="text-lg font-bold text-green-800 flex items-center gap-2">
                <span>⚡</span> {title}
            </h3>

            {/* Taproot Asset Decoding */}
            {decodedAssetInvoice && (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-300">
                    <span className="text-xs text-indigo-700 block mb-1 font-semibold">Taproot Asset Decoded via LNC</span>
                    <div className="text-sm text-indigo-900 space-y-1">
                        <p><span className="font-semibold">Asset:</span> {assetName}</p>
                        {assetType && <p><span className="font-semibold">Asset Type:</span> {assetType}</p>}
                        {scriptKeyType && <p><span className="font-semibold">Script Key Type:</span> {scriptKeyType}</p>}
                        <p><span className="font-semibold">Asset Amount:</span> {formatAssetAmount(assetAmount, assetDecimals)}</p>
                        <p><span className="font-semibold">Raw Units:</span> {(assetAmount || '0').toString()}</p>
                        {assetIdHex && (
                            <p className="font-mono text-xs break-all">
                                <span className="font-semibold">Asset ID:</span> {assetIdHex}
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Amount */}
            {amountMillisats && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Amount</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-green-600">
                            {formatSats(amountMillisats)}
                        </span>
                        <span className="text-sm text-gray-600">sats</span>
                    </div>
                    <span className="text-xs text-gray-500">
                        {amountMillisats.toLocaleString()} millisats
                    </span>
                </div>
            )}

            {/* Payment Hash */}
            {paymentHash && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Payment Hash</span>
                    <span className="text-xs font-mono text-gray-700 break-all block">
                        {paymentHash}
                    </span>
                </div>
            )}

            {/* Description */}
            {description && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Description</span>
                    <span className="text-sm text-gray-800">{description}</span>
                </div>
            )}

            {/* Timestamp */}
            {timestamp && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Created</span>
                    <span className="text-sm text-gray-800">
                        {formatTimestamp(timestamp)}
                    </span>
                </div>
            )}

            {/* Expiry */}
            {expiry && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Expires In</span>
                    <span className="text-sm text-gray-800">{expiry} seconds</span>
                </div>
            )}

            {/* Payee Node */}
            {payeeNode && (
                <div className="bg-white p-4 rounded-lg border border-green-300">
                    <span className="text-xs text-gray-500 block mb-1">Payee Node</span>
                    <span className="text-xs font-mono text-gray-700 break-all block">
                        {payeeNode}
                    </span>
                </div>
            )}

            {/* Raw Invoice */}
            <details className="bg-gray-50 p-3 rounded-lg border border-gray-300">
                <summary className="text-xs font-semibold text-gray-700 cursor-pointer">
                    View Raw Invoice
                </summary>
                <div className="mt-2 p-2 bg-white rounded border border-gray-200">
                    <span className="text-xs font-mono text-gray-600 break-all block">
                        {invoice}
                    </span>
                </div>
            </details>
        </div>
    );
}

export default InvoiceDecoder;
