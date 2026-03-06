import { useState, useCallback, useEffect } from 'react';
import { Buffer } from 'buffer';

const base64ToHex = (base64) => `0x${Buffer.from(base64, 'base64').toString('hex')}`;
const DEMO_SELECTED_ASSET_ID = '9745fa9095b11cf9f626fa71cf482197a2dee1796a2d6f66a9f69d234d3b6a1a';
const FORCED_INVOICE_ASSET_ID = '9745fa9095b11cf9f626fa71cf482197a2dee1796a2d6f66a9f69d234d3b6a1a';
const normalizeHex = (hex) => (hex || '').replace(/^0x/, '').toLowerCase();
const hexToBase64 = (hex) => {
    const normalized = normalizeHex(hex);
    if (!normalized) return '';
    return Buffer.from(normalized, 'hex').toString('base64');
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

            // Strategy 2: fallback to tapd views if available.
            if (lncClient?.tapd?.taprootAssets) {
                const taprootAssetsApi = lncClient.tapd.taprootAssets;
                const [allAssetsResult, allBalancesResult, allUtxosResult] = await Promise.allSettled([
                    taprootAssetsApi.listAssets({
                        includeLeased: true,
                        scriptKeyType: {
                            allTypes: true,
                        },
                    }),
                    taprootAssetsApi.listBalances({
                        assetId: true,
                        includeLeased: true,
                        scriptKeyType: {
                            allTypes: true,
                        },
                    }),
                    taprootAssetsApi.listUtxos({
                        includeLeased: true,
                        scriptKeyType: {
                            allTypes: true,
                        },
                    }),
                ]);
                const allAssets = allAssetsResult.status === 'fulfilled' ? (allAssetsResult.value.assets || []) : [];
                const allBalances = allBalancesResult.status === 'fulfilled' ? (allBalancesResult.value.assetBalances || {}) : {};
                const allUtxos = allUtxosResult.status === 'fulfilled' ? (allUtxosResult.value.managedUtxos || {}) : {};

                const metadataByAssetId = new Map();
                allAssets.forEach((asset) => {
                    const assetId = bytesToHex(asset?.assetGenesis?.assetId);
                    if (!assetId) return;
                    metadataByAssetId.set(assetId, {
                        name: asset?.assetGenesis?.name || 'Channel Asset',
                        amount: asset?.amount || '0',
                        scriptKeyType: asset?.scriptKeyType,
                    });
                });

                const upsertTapdChannelAsset = (assetId, partial) => {
                    if (!assetId) return;
                    const metadata = metadataByAssetId.get(assetId);
                    upsertChannelAsset(assetId, {
                        name: partial.name || metadata?.name,
                        amount: partial.amount || metadata?.amount,
                        channelBalance: partial.channelBalance || allBalances[assetId]?.balance || '0',
                        scriptKeyType: partial.scriptKeyType || metadata?.scriptKeyType || 'SCRIPT_KEY_CHANNEL',
                        source: partial.source,
                    });
                };

                allAssets.forEach((asset) => {
                    if (!isChannelScriptKeyType(asset?.scriptKeyType)) return;
                    const assetId = bytesToHex(asset?.assetGenesis?.assetId);
                    upsertTapdChannelAsset(assetId, {
                        name: asset?.assetGenesis?.name || 'Channel Asset',
                        amount: asset?.amount || '0',
                        scriptKeyType: asset?.scriptKeyType,
                        source: 'listAssets',
                    });
                });

                Object.values(allUtxos).forEach((utxo) => {
                    (utxo?.assets || []).forEach((asset) => {
                        if (!isChannelScriptKeyType(asset?.scriptKeyType)) return;
                        const assetId = bytesToHex(asset?.assetGenesis?.assetId);
                        upsertTapdChannelAsset(assetId, {
                            name: asset?.assetGenesis?.name || 'Channel Asset',
                            amount: asset?.amount || '0',
                            scriptKeyType: asset?.scriptKeyType || 'SCRIPT_KEY_CHANNEL',
                            source: 'listUtxos',
                        });
                    });
                });

                Object.entries(allBalances).forEach(([rawAssetId, entry]) => {
                    const assetId = bytesToHex(rawAssetId);
                    if (!assetId || !channelAssetMap.has(assetId)) return;
                    upsertTapdChannelAsset(assetId, {
                        channelBalance: entry?.balance || '0',
                        source: 'listBalances',
                    });
                });
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

            setAssets(merged);

            // Demo mode: prefer a specific asset ID, then channel asset, then first asset.
            if (merged.length > 0) {
                setSelectedAsset(prev => {
                    if (prev) return prev; // Do not overwrite if already selected
                    const demoAsset = merged.find(
                        (asset) => normalizeHex(asset.assetId) === DEMO_SELECTED_ASSET_ID
                    );
                    const channelAsset = merged.find((asset) => asset.inChannels);
                    return demoAsset || channelAsset || merged[0];
                });
            }
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

        if (!asset) {
            throw new Error('No asset selected');
        }

        try {
            const assetIdHex = normalizeHex(FORCED_INVOICE_ASSET_ID);
            const assetIdCandidates = [
                assetIdHex,            // hex string (preferred)
                `0x${assetIdHex}`,     // prefixed hex
                hexToBase64(assetIdHex), // base64 bytes string
            ].filter(Boolean);

            let lastError = null;
            for (const encodedAssetId of assetIdCandidates) {
                try {
                    const request = {
                        assetId: encodedAssetId,
                        assetAmount: amountSats.toString(),
                        invoiceRequest: {
                            memo: memo || `Taproot Asset Swap: ${asset.name}`,
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
                        assetId: FORCED_INVOICE_ASSET_ID,
                        assetName: asset.name,
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
    };
};
