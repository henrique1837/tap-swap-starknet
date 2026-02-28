import React, { useState, useEffect } from 'react';
import { decode } from 'light-bolt11-decoder';
import { Buffer } from 'buffer';

const normalizeHex = (hex) => (hex || '').replace(/^0x/, '').toLowerCase();
const hexToBase64 = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return '';
    return Buffer.from(normalized, 'hex').toString('base64');
};

function InvoiceDecoder({ invoice, title = "Invoice Details", lncClient, assetId }) {
    const [decodedInvoice, setDecodedInvoice] = useState(null);
    const [decodedAssetInvoice, setDecodedAssetInvoice] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let isMounted = true;

        const decodeInvoice = async () => {
            if (!invoice || invoice.trim() === '') {
                if (!isMounted) return;
                setDecodedInvoice(null);
                setDecodedAssetInvoice(null);
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
                return;
            }

            if (!lncClient?.tapd?.tapChannels?.decodeAssetPayReq) {
                if (!isMounted) return;
                setDecodedAssetInvoice(null);
                return;
            }

            const candidateId = normalizeHex(assetId || '');
            if (!candidateId) {
                if (!isMounted) return;
                setDecodedAssetInvoice(null);
                return;
            }

            const assetIdCandidates = [
                candidateId,
                `0x${candidateId}`,
                hexToBase64(candidateId),
            ].filter(Boolean);

            let parsedAssetInvoice = null;
            for (const encodedAssetId of assetIdCandidates) {
                try {
                    const response = await lncClient.tapd.tapChannels.decodeAssetPayReq({
                        assetId: encodedAssetId,
                        payReqString: invoice.trim(),
                    });
                    parsedAssetInvoice = response;
                    break;
                } catch {
                    // Try next encoding candidate.
                }
            }

            if (!isMounted) return;
            setDecodedAssetInvoice(parsedAssetInvoice);
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
    const assetName = decodedAssetInvoice?.genesisInfo?.name || 'Taproot Asset';
    const assetDecimals = decodedAssetInvoice?.decimalDisplay?.decimalDisplay;
    const assetIdHex = normalizeHex(decodedAssetInvoice?.genesisInfo?.assetId || assetId || '');

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
