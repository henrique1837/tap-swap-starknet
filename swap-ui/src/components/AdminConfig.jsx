import React from 'react';

const AdminConfig = ({ channelAssets, activeAssetId, changeActiveAssetId, isLoading, fetchAssets }) => {
    const handleSetActive = (assetId) => {
        changeActiveAssetId(assetId);
        fetchAssets();
    };

    const handleClearActive = () => {
        changeActiveAssetId(null);
        fetchAssets();
    };

    return (
        <div className="w-full space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <p className="text-sm text-slate-400 font-medium whitespace-nowrap">Manage your active Taproot Swap Asset ID.</p>
                </div>
                <button
                    onClick={fetchAssets}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 disabled:opacity-50 transition-colors flex items-center gap-2"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    ) : 'Refresh Assets'}
                </button>
            </div>

            <div className="p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 items-start flex gap-4">
                <div className="flex-1">
                    <h4 className="text-sm font-bold text-indigo-400 mb-2">Active Asset Configuration</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        Select the asset from your channels that you want to use for swaps. This overrides the default application configuration.
                    </p>
                    <div className="bg-black/40 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Current Active ID</p>
                            <p className="text-[11px] font-mono font-semibold text-slate-300 break-all">{activeAssetId || 'Using Environment Default'}</p>
                        </div>
                        {localStorage.getItem('tapswap_active_asset_id') && (
                            <button
                                onClick={handleClearActive}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition-colors whitespace-nowrap"
                            >
                                Clear Override
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest pl-1">Channel Assets</h3>

            {channelAssets.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-2xl border-2 border-dashed border-white/5 bg-white/5">
                    <svg className="w-10 h-10 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    <p className="text-sm font-medium text-slate-400">No channel assets found.</p>
                    <p className="text-xs text-slate-500 mt-1">Make sure your LNC node is connected and you have Taproot Asset channels open.</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {channelAssets.map((asset) => {
                        const isActive = asset.assetId.toLowerCase() === activeAssetId?.toLowerCase();
                        return (
                            <div
                                key={asset.assetId}
                                className={`p-5 rounded-2xl border transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isActive ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10'}`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-base font-bold text-slate-200">{asset.name || 'Unknown Asset'}</h4>
                                        {isActive && (
                                            <span className="bg-indigo-500/20 text-indigo-400 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border border-indigo-500/30">Active</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] font-mono text-slate-500 truncate mb-3" title={asset.assetId}>{asset.assetId}</p>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Channel Balance</p>
                                            <p className="text-xs font-bold text-emerald-400">{parseInt(asset.channelBalance).toLocaleString()}</p>
                                        </div>
                                        <div className="bg-black/30 border border-white/5 rounded-xl p-2.5">
                                            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Amount</p>
                                            <p className="text-xs font-bold text-slate-400">{parseInt(asset.amount || '0').toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:ml-auto md:pl-4 md:border-l border-white/5 flex items-center justify-end">
                                    <button
                                        onClick={() => handleSetActive(asset.assetId)}
                                        disabled={isActive}
                                        className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${isActive ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg transform hover:-translate-y-0.5'}`}
                                    >
                                        {isActive ? 'Currently Active' : 'Set as Active'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AdminConfig;
