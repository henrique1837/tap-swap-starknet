import React, { useState, useEffect, useCallback } from 'react';
import { useTaprootAssets } from '../hooks/useTaprootAssets';

function NodeInfo({ lncClient, isConnected }) {
    const [nodeInfo, setNodeInfo] = useState(null);
    const [channelInfo, setChannelInfo] = useState(null);
    const [balanceInfo, setBalanceInfo] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const {
        assets: taprootAssets,
        channelAssets: channelTapAssets,
        isLoading: isLoadingAssets,
        isTapdAvailable,
        fetchAssets,
    } = useTaprootAssets(lncClient, isConnected);

    const fetchNodeInfo = useCallback(async () => {
        if (!lncClient?.lnd?.lightning || !isConnected) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Fetch node information
            const info = await lncClient.lnd.lightning.getInfo();
            setNodeInfo(info);

            // Fetch channel information
            const channels = await lncClient.lnd.lightning.listChannels();
            setChannelInfo(channels);

            // Fetch balance information
            const onChainBalance = await lncClient.lnd.lightning.walletBalance();
            const channelBalance = await lncClient.lnd.lightning.channelBalance();
            setBalanceInfo({
                onChain: onChainBalance,
                channel: channelBalance,
            });

            if (isTapdAvailable) {
                await fetchAssets();
            }
        } catch (err) {
            console.error('Error fetching node info:', err);
            setError(err.message || 'Failed to fetch node information');
        } finally {
            setIsLoading(false);
        }
    }, [lncClient, isConnected, fetchAssets, isTapdAvailable]);

    useEffect(() => {
        if (isConnected) {
            fetchNodeInfo();
        } else {
            setNodeInfo(null);
            setChannelInfo(null);
            setBalanceInfo(null);
            setError(null);
        }
    }, [isConnected, fetchNodeInfo]);

    const formatSats = (sats) => {
        if (!sats) return '0';
        const num = parseInt(sats);
        return num.toLocaleString();
    };

    const formatBTC = (sats) => {
        if (!sats) return '0.00000000';
        const btc = parseInt(sats) / 100000000;
        return btc.toFixed(8);
    };

    if (!isConnected) {
        return (
            <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
                <p className="text-rose-400 font-bold flex items-center gap-2"><span className="text-lg">⚠️</span> LNC Not Connected</p>
                <p className="text-sm text-rose-300/80 mt-2">
                    Connect to your Lightning Node via LNC to view node information.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Refresh Button */}
            <div className="flex justify-end">
                <button
                    onClick={fetchNodeInfo}
                    disabled={isLoading}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-bold text-sm shadow-sm"
                >
                    <span className={isLoading ? 'animate-spin' : ''}>↻</span>
                    Refresh Data
                </button>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-5 py-4 rounded-xl text-sm font-medium">
                    {error}
                </div>
            )}

            {isLoading && !nodeInfo ? (
                <div className="space-y-4">
                    <div className="h-28 bg-white/5 rounded-2xl animate-pulse"></div>
                    <div className="h-28 bg-white/5 rounded-2xl animate-pulse"></div>
                    <div className="h-28 bg-white/5 rounded-2xl animate-pulse"></div>
                </div>
            ) : nodeInfo ? (
                <div className="space-y-5">
                    {/* Node Identity */}
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                        <h3 className="text-xs font-bold text-indigo-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                            <span>⚡</span> Node Identity
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">Alias</span>
                                <span className="text-lg font-black text-slate-200">{nodeInfo.alias || 'Unknown'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">Public Key</span>
                                <span className="text-[11px] font-mono text-slate-400 break-all bg-black/40 p-3 rounded-xl border border-white/5 block shadow-inner">
                                    {nodeInfo.identityPubkey}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">Version</span>
                                    <span className="text-sm font-bold text-slate-300">{nodeInfo.version}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1 tracking-wider">Network</span>
                                    <span className="text-sm font-bold text-slate-300 capitalize">
                                        {nodeInfo.chains?.[0]?.network || 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sync Status */}
                    <div className="bg-emerald-500/5 p-6 rounded-2xl border border-emerald-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                        <h3 className="text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                            <span>🔄</span> Sync Status
                        </h3>
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`w-3 h-3 rounded-full ${nodeInfo.syncedToChain ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse' : 'bg-amber-400'}`}></div>
                            <span className="text-base font-bold text-slate-200">
                                {nodeInfo.syncedToChain ? 'Fully Synced' : 'Syncing...'}
                            </span>
                            {nodeInfo.syncedToGraph && (
                                <span className="text-[10px] font-bold text-emerald-500/90 bg-emerald-500/20 border border-emerald-500/30 px-2 py-1 rounded-full uppercase tracking-wider">Graph Synced</span>
                            )}
                        </div>
                        <div className="text-sm text-slate-400 bg-black/40 border border-white/5 p-3 rounded-xl shadow-inner inline-flex items-center gap-2">
                            <span className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Block Height</span> <span className="font-mono font-bold text-slate-300">{nodeInfo.blockHeight?.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Balances */}
                    {balanceInfo && (
                        <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                            <h3 className="text-xs font-bold text-amber-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                <span>💰</span> Balances
                            </h3>
                            <div className="space-y-4">
                                <div className="bg-black/20 p-5 rounded-xl border border-white/5">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2 tracking-wider">Lightning Balance</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-amber-400">
                                            {formatSats(balanceInfo.channel?.balance)}
                                        </span>
                                        <span className="text-sm font-bold text-amber-500/50 uppercase tracking-widest">sats</span>
                                    </div>
                                    <span className="text-xs font-medium text-amber-300/60 mt-1 block">
                                        {formatBTC(balanceInfo.channel?.balance)} BTC
                                    </span>
                                </div>
                                <div className="bg-black/20 p-5 rounded-xl border border-white/5">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2 tracking-wider">On-Chain Balance</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-orange-400">
                                            {formatSats(balanceInfo.onChain?.confirmedBalance)}
                                        </span>
                                        <span className="text-sm font-bold text-orange-500/50 uppercase tracking-widest">sats</span>
                                    </div>
                                    <span className="text-xs font-medium text-orange-300/60 mt-1 block">
                                        {formatBTC(balanceInfo.onChain?.confirmedBalance)} BTC
                                    </span>
                                    {balanceInfo.onChain?.unconfirmedBalance && parseInt(balanceInfo.onChain.unconfirmedBalance) > 0 && (
                                        <div className="text-[11px] font-bold text-amber-400 mt-3 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg flex items-center justify-between">
                                            <span className="uppercase tracking-wide text-amber-500/70">Unconfirmed</span>
                                            <span>{formatSats(balanceInfo.onChain.unconfirmedBalance)} sats</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Taproot Assets (On-Chain) */}
                    {isTapdAvailable && (
                        <div className="bg-indigo-500/5 p-6 rounded-2xl border border-indigo-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                            <h3 className="text-xs font-bold text-indigo-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                <span>🪙</span> Taproot Assets (On-Chain)
                            </h3>

                            {isLoadingAssets ? (
                                <div className="space-y-3">
                                    <div className="h-14 bg-white/5 rounded-xl animate-pulse"></div>
                                    <div className="h-14 bg-white/5 rounded-xl animate-pulse"></div>
                                </div>
                            ) : taprootAssets.length === 0 ? (
                                <div className="bg-white/5 p-5 rounded-xl border border-white/10 text-center">
                                    <p className="text-sm font-medium text-slate-400">No Taproot Assets found</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {taprootAssets.map((asset) => (
                                        <div key={asset.assetId} className="bg-white/5 p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors shadow-sm flex items-center justify-between group">
                                            <div>
                                                <p className="font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">{asset.name}</p>
                                                <p className="text-[10px] text-slate-500 font-mono break-all line-clamp-1 mt-1 tracking-wider" title={asset.assetId}>
                                                    ID: {asset.assetId.slice(0, 8)}...{asset.assetId.slice(-8)}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-widest block mb-0.5">Balance</span>
                                                <span className="font-black text-indigo-400 text-lg">{parseInt(asset.amount).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-5 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                                <p className="text-[11px] font-bold text-emerald-400 mb-3 flex items-center justify-between uppercase tracking-wider">
                                    <span className="flex items-center gap-2"><span>⚡</span> Assets in Channels</span>
                                    <span className="bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300">{channelTapAssets.length}</span>
                                </p>
                                {isLoadingAssets ? (
                                    <p className="text-[10px] text-emerald-500/50 uppercase font-bold tracking-widest animate-pulse">Loading channel assets...</p>
                                ) : channelTapAssets.length > 0 ? (
                                    <div className="space-y-2.5">
                                        {channelTapAssets.map((asset) => (
                                            <div key={asset.assetId} className="bg-black/30 p-3 rounded-lg border border-emerald-500/10">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-xs font-bold text-slate-300">{asset.name}</span>
                                                    <span className="text-xs font-black font-mono text-emerald-400">{parseInt(asset.channelBalance || asset.balance || 0).toLocaleString()}</span>
                                                </div>
                                                <p className="text-[9px] text-slate-500 font-mono mt-1.5 uppercase tracking-wider truncate">
                                                    {asset.assetId.slice(0, 8)}...{asset.assetId.slice(-8)} [{(asset.sources || []).join(',')}]
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest">No channel assets currently detected.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Channels */}
                    {channelInfo && (
                        <div className="bg-cyan-500/5 p-6 rounded-2xl border border-cyan-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
                            <h3 className="text-xs font-bold text-cyan-400 mb-4 uppercase tracking-widest flex items-center gap-2">
                                <span>🔗</span> Channels
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-black/20 p-5 rounded-xl border border-white/5 text-center flex flex-col items-center justify-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2 tracking-wider">Active Channels</span>
                                    <span className="text-3xl font-black text-cyan-400">{channelInfo.channels?.length || 0}</span>
                                </div>
                                <div className="bg-black/20 p-5 rounded-xl border border-white/5 text-center flex flex-col items-center justify-center">
                                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-2 tracking-wider">Total Capacity</span>
                                    <div className="flex items-baseline justify-center gap-1.5">
                                        <span className="text-xl font-black text-blue-400">
                                            {formatSats(channelInfo.channels?.reduce((sum, ch) => sum + parseInt(ch.capacity || 0), 0))}
                                        </span>
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">sats</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="bg-gradient-to-br from-indigo-500/20 to-purple-500/20 p-6 rounded-2xl border border-indigo-500/20 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[50px] rounded-full"></div>
                        <h3 className="text-xs font-bold text-indigo-300 border-b border-indigo-500/20 pb-2 mb-4 uppercase tracking-widest inline-block">Quick Stats</h3>
                        <div className="grid grid-cols-3 gap-4 text-center relative z-10">
                            <div className="bg-white/5 py-4 rounded-xl border border-white/5">
                                <div className="text-2xl font-black text-white">{nodeInfo.numActiveChannels || 0}</div>
                                <div className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mt-1">Active</div>
                            </div>
                            <div className="bg-white/5 py-4 rounded-xl border border-white/5">
                                <div className="text-2xl font-black text-white">{nodeInfo.numPendingChannels || 0}</div>
                                <div className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mt-1">Pending</div>
                            </div>
                            <div className="bg-white/5 py-4 rounded-xl border border-white/5">
                                <div className="text-2xl font-black text-white">{nodeInfo.numPeers || 0}</div>
                                <div className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest mt-1">Peers</div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default NodeInfo;
