import React from 'react';

function TaprootAssetSelector({
    assets,
    selectedAsset,
    onSelectAsset,
    isLoading,
    error,
    onRefresh,
    demoMode = true
}) {
    if (!demoMode && assets.length > 0) {
        // Production mode: auto-select TAPROOT_STRK and don't show selector
        const taprootStrk = assets.find(a => a.name === 'TAPROOT_STRK') || assets[0];
        if (selectedAsset?.assetId !== taprootStrk?.assetId) {
            onSelectAsset(taprootStrk);
        }
        return (
            <div className="bg-white/80 backdrop-blur-lg p-5 rounded-2xl shadow-lg w-full max-w-2xl mb-6 border border-white/50">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2 mb-3">
                    <span className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg">🪙</span>
                    Selected Asset
                </h3>
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-lg font-bold text-emerald-700">{taprootStrk.name}</p>
                            <p className="text-xs text-slate-500 font-mono mt-1">ID: {taprootStrk.assetId.slice(0, 16)}...</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Balance</p>
                            <p className="text-xl font-bold text-emerald-600">{parseInt(taprootStrk.amount).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white/80 backdrop-blur-lg p-6 rounded-3xl shadow-xl w-full max-w-2xl mb-6 border border-white/50">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-amber-100 text-amber-600 p-2 rounded-xl">🪙</span>
                    Select Taproot Asset
                </h3>
                <button
                    onClick={onRefresh}
                    disabled={isLoading}
                    className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl transition duration-300 disabled:opacity-50 text-sm"
                >
                    <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    {isLoading ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
                    {error}
                </div>
            )}

            {isLoading ? (
                <div className="space-y-3">
                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>
                    <div className="h-20 bg-slate-100 rounded-xl animate-pulse"></div>
                </div>
            ) : assets.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50">
                    <p className="font-semibold text-amber-800">No Taproot Assets Found</p>
                    <p className="text-xs text-amber-700 mt-1">Make sure you have Taproot Assets in your wallet and channels.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {assets.map((asset) => (
                        <div
                            key={asset.assetId}
                            onClick={() => onSelectAsset(asset)}
                            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all duration-200 ${selectedAsset?.assetId === asset.assetId
                                ? 'border-amber-400 bg-amber-50 shadow-md ring-1 ring-amber-200'
                                : 'border-slate-200 bg-white hover:border-amber-300 hover:shadow-sm'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="text-base font-bold text-slate-800">{asset.name}</p>
                                        {selectedAsset?.assetId === asset.assetId && (
                                            <span className="text-xs bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">✓ Selected</span>
                                        )}
                                        {asset.inChannels && (
                                            <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                                                ⚡ In Channel
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 font-mono mt-1">
                                        ID: {asset.assetId.slice(0, 32)}...
                                    </p>
                                    {asset.groupKey && (
                                        <p className="text-xs text-slate-400 font-mono mt-0.5">
                                            Group: {asset.groupKey.slice(0, 16)}...
                                        </p>
                                    )}
                                </div>
                                <div className="text-right ml-4">
                                    <p className="text-xs text-slate-500 mb-1">Balance</p>
                                    <p className="text-xl font-bold text-amber-600">
                                        {parseInt(asset.amount).toLocaleString()}
                                    </p>
                                    <p className="text-xs text-slate-400 mt-0.5 capitalize">{asset.assetType?.toLowerCase()}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedAsset && (
                <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="text-sm text-amber-800 font-medium">
                        <span className="font-bold">Selected:</span> {selectedAsset.name} ({parseInt(selectedAsset.amount).toLocaleString()} units available)
                    </p>
                </div>
            )}

            {demoMode && (
                <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <p className="text-xs text-slate-600">
                        <span className="font-bold text-slate-700">Demo Mode:</span> In production, only "TAPROOT_STRK" asset will be used automatically.
                    </p>
                </div>
            )}
        </div>
    );
}

export default TaprootAssetSelector;
