import { useState, useCallback, useEffect } from 'react';
import { Buffer } from 'buffer';

const base64ToHex = (base64) => `0x${Buffer.from(base64, 'base64').toString('hex')}`;
const normalizeHex = (hex) => (hex || '').replace(/^0x/, '').toLowerCase();
const CONFIGURED_ASSET_ID = normalizeHex(import.meta.env.VITE_TAPROOT_ASSET_ID || '');
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

const bytesToBase64 = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const raw = value.startsWith('0x') ? value.slice(2) : value;
        if (/^[0-9a-fA-F]+$/.test(raw)) {
            return Buffer.from(raw, 'hex').toString('base64');
        }
        return value;
    }
    if (value instanceof Uint8Array || Array.isArray(value)) {
        return Buffer.from(value).toString('base64');
    }
    if (typeof value === 'object') {
        const numericValues = Object.keys(value)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => value[key]);
        if (numericValues.length > 0) {
            return Buffer.from(numericValues).toString('base64');
        }
    }
    return '';
};

const isChannelScriptKeyType = (value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.toUpperCase().includes('CHANNEL');
    if (typeof value === 'number') return value === 6;
    if (typeof value === 'object') {
        return isChannelScriptKeyType(value.explicitType)
            || isChannelScriptKeyType(value.scriptKeyType)
            || isChannelScriptKeyType(value.type)
            || isChannelScriptKeyType(value.name)
            || isChannelScriptKeyType(value.value);
    }
    return false;
};

const parseChannelCustomData = (value) => {
    if (!value) return null;
    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Uint8Array)) {
        return value;
    }

    const tryParseJson = (text) => {
        if (!text || typeof text !== 'string') return null;
        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    };

    if (typeof value === 'string') {
        return tryParseJson(value) || tryParseJson(Buffer.from(value, 'base64').toString('utf8'));
    }

    if (value instanceof Uint8Array || Array.isArray(value)) {
        return tryParseJson(Buffer.from(value).toString('utf8'));
    }

    return null;
};

const toBigIntSafe = (value) => {
    if (value === null || value === undefined || value === '') return 0n;
    if (typeof value === 'bigint') return value;
    try {
        return BigInt(value);
    } catch {
        return 0n;
    }
};

export const useTaprootAssets = (lncClient, isConnected) => {
    const [assets, setAssets] = useState([]);
    const [channelAssets, setChannelAssets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedAsset, setSelectedAsset] = useState(null);

    const [activeAssetId, setActiveAssetIdState] = useState(() => {
        const stored = localStorage.getItem('tapswap_active_asset_id');
        return stored !== null ? normalizeHex(stored) : CONFIGURED_ASSET_ID;
    });

    const changeActiveAssetId = useCallback((newId) => {
        const normalized = newId ? normalizeHex(newId) : '';
        if (normalized) {
            localStorage.setItem('tapswap_active_asset_id', normalized);
        } else {
            localStorage.removeItem('tapswap_active_asset_id');
        }
        setActiveAssetIdState(normalized || CONFIGURED_ASSET_ID);
    }, []);

    // Check if tapd is available
    const isTapdAvailable = useCallback(() => {
        return Boolean(lncClient?.tapd?.taprootAssets);
    }, [lncClient]);

    // Check if tapd channels service is available
    const isTapdChannelsAvailable = useCallback(() => {
        return Boolean(lncClient?.tapd?.tapChannels?.addInvoice);
    }, [lncClient]);

    // Fetch assets in channels
    const fetchChannelAssets = useCallback(async () => {
        if (!isConnected) {
            setChannelAssets([]);
            return [];
        }

        try {
            const channelAssetMap = new Map();
            const upsertChannelAsset = (assetId, partial) => {
                if (!assetId) return;
                const current = channelAssetMap.get(assetId) || {
                    assetId,
                    name: 'Channel Asset',
                    amount: '0',
                    channelBalance: '0',
                    scriptKeyType: 'SCRIPT_KEY_CHANNEL',
                    sources: [],
                };

                if (partial.name) current.name = partial.name;
                if (partial.amount && current.amount === '0') current.amount = partial.amount;
                if (partial.channelBalance) current.channelBalance = partial.channelBalance;
                if (partial.scriptKeyType) current.scriptKeyType = partial.scriptKeyType;
                if (partial.source) {
                    current.sources = Array.from(new Set([...(current.sources || []), partial.source]));
                }
                channelAssetMap.set(assetId, current);
            };

            // Strategy 1 (preferred): infer channel assets from LND channel overlay data.
            if (lncClient?.lnd?.lightning?.listChannels) {
                try {
                    const channelsResponse = await lncClient.lnd.lightning.listChannels({
                        activeOnly: false,
                        inactiveOnly: false,
                        publicOnly: false,
                        privateOnly: false,
                    });

                    for (const channel of channelsResponse?.channels || []) {
                        const rawCustomData = parseChannelCustomData(channel?.customChannelData);
                        if (!rawCustomData) continue;

                        const fundingAssets = rawCustomData.fundingAssets || rawCustomData.funding_assets || [];
                        const localAssets = rawCustomData.localAssets || rawCustomData.local_assets || [];
                        const remoteAssets = rawCustomData.remoteAssets || rawCustomData.remote_assets || [];

                        const localById = new Map();
                        for (const entry of localAssets) {
                            const localId = normalizeHex(entry?.assetId || entry?.asset_id || '');
                            if (!localId) continue;
                            localById.set(localId, (localById.get(localId) || 0n) + toBigIntSafe(entry?.amount));
                        }

                        const remoteById = new Map();
                        for (const entry of remoteAssets) {
                            const remoteId = normalizeHex(entry?.assetId || entry?.asset_id || '');
                            if (!remoteId) continue;
                            remoteById.set(remoteId, (remoteById.get(remoteId) || 0n) + toBigIntSafe(entry?.amount));
                        }

                        for (const fundingAsset of fundingAssets) {
                            const genesis = fundingAsset?.assetGenesis || fundingAsset?.asset_genesis || {};
                            const fundingId = normalizeHex(genesis?.assetId || genesis?.asset_id || '');
                            if (!fundingId) continue;

                            const localAmt = localById.get(fundingId) || 0n;
                            const remoteAmt = remoteById.get(fundingId) || 0n;
                            const totalChannelAmt = localAmt + remoteAmt;

                            upsertChannelAsset(fundingId, {
                                name: genesis?.name || 'Channel Asset',
                                amount: totalChannelAmt > 0n ? totalChannelAmt.toString() : toBigIntSafe(fundingAsset?.amount).toString(),
                                channelBalance: localAmt.toString(),
                                scriptKeyType: 'SCRIPT_KEY_CHANNEL',
                                source: 'listChannels.customChannelData',
                            });
                        }
                    }
                } catch (err) {
                    console.warn('listChannels channel-asset parsing failed:', err);
                }
            }

            // Strategy 2 (Supplemental): use tapd views ONLY for supplemental metadata (names)
            // if we already found the asset in channels via Strategy 1.
            // We NO LONGER use Strategy 2 to discover assets or determine balances as per user request.
            if (lncClient?.tapd?.taprootAssets && channelAssetMap.size > 0) {
                try {
                    const response = await lncClient.tapd.taprootAssets.listAssets({
                        includeLeased: true,
                        scriptKeyType: { allTypes: true },
                    });

                    for (const asset of response.assets || []) {
                        const assetId = bytesToHex(asset?.assetGenesis?.assetId);
                        const normalizedId = normalizeHex(assetId);
                        if (channelAssetMap.has(normalizedId)) {
                            const current = channelAssetMap.get(normalizedId);
                            if (asset?.assetGenesis?.name && (!current.name || current.name === 'Channel Asset')) {
                                current.name = asset.assetGenesis.name;
                            }
                            // We can also add other sources if it helps debugging, but we don't overwrite balance.
                            if (!current.sources.includes('listAssets (metadata)')) {
                                current.sources.push('listAssets (metadata)');
                            }
                        }
                    }
                } catch (err) {
                    console.warn('Supplemental metadata fetch failed:', err);
                }
            }

            const assetsInChannels = Array.from(channelAssetMap.values());
            setChannelAssets(assetsInChannels);
            return assetsInChannels;
        } catch (err) {
            console.error('Error fetching channel assets:', err);
            setChannelAssets([]);
            return [];
        }
    }, [lncClient, isConnected]);

    // Fetch all Taproot Assets
    const fetchAssets = useCallback(async () => {
        if (!isConnected) {
            setAssets([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Also fetch channel assets to cross-reference
            const channelAssetsList = await fetchChannelAssets();
            const channelAssetById = new Map(channelAssetsList.map((asset) => [normalizeHex(asset.assetId), asset]));

            let assetList = [];
            if (isTapdAvailable()) {
                // List all wallet assets (on-chain + known script key types).
                const response = await lncClient.tapd.taprootAssets.listAssets({
                    withWitness: false,
                    includeLeased: true,
                    scriptKeyType: {
                        allTypes: true,
                    },
                });
                assetList = response.assets || [];
            }

            // Transform assets to a more usable format
            const formattedAssets = assetList.map((asset) => {
                const assetId = bytesToHex(asset.assetGenesis?.assetId);
                const normalizedAssetId = normalizeHex(assetId);

                // Check if this asset is in any channels
                const channelEntry = channelAssetById.get(normalizedAssetId);
                const inChannels = Boolean(channelEntry) || isChannelScriptKeyType(asset.scriptKeyType);

                return {
                    assetId,
                    name: asset.assetGenesis?.name || 'Unknown Asset',
                    assetType: asset.assetGenesis?.assetType || 'NORMAL',
                    amount: asset.amount || '0',
                    groupKey: asset.assetGroup?.tweakedGroupKey ?
                        bytesToHex(asset.assetGroup.tweakedGroupKey) : null,
                    scriptKey: asset.scriptKey ? bytesToHex(asset.scriptKey) : null,
                    anchorOutpoint: asset.chainAnchor?.anchorOutpoint || null,
                    scriptKeyType: asset.scriptKeyType || null,
                    inChannels, // Flag to indicate if asset is in channels
                    channelBalance: channelEntry?.channelBalance || '0',
                };
            });

            // Ensure channel assets parsed from listChannels are represented even if tapd omits them.
            const merged = [...formattedAssets];
            for (const channelAsset of channelAssetsList) {
                const channelId = normalizeHex(channelAsset.assetId);
                const exists = merged.some((asset) => normalizeHex(asset.assetId) === channelId);
                if (exists) continue;

                merged.push({
                    assetId: channelAsset.assetId,
                    name: channelAsset.name || 'Channel Asset',
                    assetType: 'NORMAL',
                    amount: channelAsset.amount || channelAsset.channelBalance || '0',
                    groupKey: null,
                    scriptKey: null,
                    anchorOutpoint: null,
                    scriptKeyType: 'SCRIPT_KEY_CHANNEL',
                    inChannels: true,
                    channelBalance: channelAsset.channelBalance || '0',
                });
            }

            const filteredAssets = activeAssetId
                ? merged.filter((asset) => normalizeHex(asset.assetId) === activeAssetId)
                : merged;

            // Show all assets in the on-chain list, but keep selectedAsset for the swap logic
            setAssets(formattedAssets);

            const configuredAsset = activeAssetId
                ? merged.find((asset) => normalizeHex(asset.assetId) === activeAssetId) || null
                : null;
            setSelectedAsset(configuredAsset);
        } catch (err) {
            console.error('Error fetching Taproot Assets:', err);
            setError(err.message || 'Failed to fetch Taproot Assets');
            setAssets([]);
        } finally {
            setIsLoading(false);
        }
    }, [lncClient, isConnected, isTapdAvailable, fetchChannelAssets]);

    // Create a Taproot Asset invoice
    const createAssetInvoice = useCallback(async (asset, amountSats, memo = '') => {
        if (!isConnected || !isTapdChannelsAvailable()) {
            throw new Error('Taproot Asset Channels service not available');
        }

        try {
            const assetIdHex = normalizeHex(activeAssetId);
            if (!assetIdHex) {
                throw new Error('Missing Taproot Asset ID. Set it in Admin page or .env.');
            }
            const assetIdCandidates = buildAssetIdEncodingCandidates(assetIdHex);
            if (assetIdCandidates.length === 0) {
                throw new Error('Taproot Asset ID must be exactly 32 bytes (64 hex chars).');
            }
            let lastError = null;
            for (const encodedAssetId of assetIdCandidates) {
                try {
                    const request = {
                        assetId: encodedAssetId,
                        assetAmount: amountSats.toString(),
                        invoiceRequest: {
                            memo: memo || `Taproot Asset Swap: ${asset?.name || 'Configured Asset'}`,
                        },
                    };
                    const invoiceResponse = await lncClient.tapd.tapChannels.addInvoice(request);

                    const paymentRequest = invoiceResponse.invoiceResult?.paymentRequest || '';
                    const rHashBase64 = bytesToBase64(invoiceResponse.invoiceResult?.rHash);
                    const paymentHash = rHashBase64 ? base64ToHex(rHashBase64) : null;

                    if (!paymentRequest || !paymentHash) {
                        throw new Error('Taproot Asset invoice response missing payment request or payment hash.');
                    }

                    return {
                        paymentRequest,
                        paymentHash,
                        assetId: assetIdHex,
                        assetName: asset?.name || 'Configured Asset',
                        assetAmount: amountSats.toString(),
                        isAssetInvoice: true,
                    };
                } catch (err) {
                    lastError = err;
                    console.warn(`Taproot invoice failed with assetId encoding "${encodedAssetId.slice(0, 16)}..."`, err);
                }
            }
            throw lastError || new Error('All assetId encodings failed for Taproot Asset invoice.');
        } catch (err) {
            console.error('Error creating Taproot Asset invoice:', err);
            throw new Error(`Failed to create Taproot Asset invoice: ${err.message || String(err)}`);
        }
    }, [lncClient, isConnected, isTapdChannelsAvailable]);

    // Fetch assets when connection status changes
    useEffect(() => {
        if (isConnected) {
            fetchAssets();
        } else {
            setAssets([]);
            setChannelAssets([]);
            setSelectedAsset(null);
        }
    }, [isConnected, fetchAssets]);

    return {
        assets,
        channelAssets,
        isLoading,
        error,
        selectedAsset,
        setSelectedAsset,
        fetchAssets,
        createAssetInvoice,
        isTapdAvailable: isTapdAvailable(),
        isTapdChannelsAvailable: isTapdChannelsAvailable(),
        activeAssetId,
        changeActiveAssetId,
    };
};
