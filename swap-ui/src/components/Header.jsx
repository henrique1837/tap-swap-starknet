import React from 'react';

function Header({
    lncIsConnected,
    lncAlias,
    nostrConnected,
    nostrPubkey,
    walletConnected,
    onOpenNostrModal,
    onOpenNodeModal,
    onOpenConnectModal,
    onOpenAdminModal,
    walletAddress
}) {
    const shortenValue = (value, left = 8, right = 6) => {
        if (!value || typeof value !== 'string') return '';
        if (value.length <= left + right + 3) return value;
        return `${value.slice(0, left)}...${value.slice(-right)}`;
    };

    const StatusItem = ({ connected, label, value, title, onClick }) => {
        const common = "group min-w-[170px] rounded-xl px-3 py-2 transition-all duration-300 text-left";
        const interactive = onClick ? "hover:bg-white/10 cursor-pointer" : "";
        const labelColor = onClick ? "group-hover:text-slate-200" : "";
        const valueColor = onClick ? "group-hover:text-white" : "";

        const content = (
            <>
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse' : 'bg-rose-500'}`}></div>
                    <span className={`text-[11px] font-bold text-slate-400 uppercase tracking-wider transition-colors ${labelColor}`}>{label}</span>
                </div>
                <p className={`text-sm font-semibold text-slate-200 truncate transition-colors ${valueColor}`}>
                    {value}
                </p>
            </>
        );

        if (onClick) {
            return (
                <button onClick={onClick} className={`${common} ${interactive}`} title={title}>
                    {content}
                </button>
            );
        }

        return (
            <div className={common} title={title}>
                {content}
            </div>
        );
    };

    const lncDisplay = lncIsConnected
        ? (lncAlias || 'Connected')
        : 'Not connected';
    const nostrDisplay = nostrConnected
        ? shortenValue(nostrPubkey || '', 10, 8)
        : 'Not linked';
    const walletDisplay = walletConnected
        ? shortenValue(walletAddress || '', 8, 6)
        : 'Not connected';

    return (
        <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 shadow-lg">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-20">
                    {/* Logo/Title */}
                    <div className="flex items-center gap-4">
                        <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl p-2.5 shadow-lg shadow-indigo-500/20">
                            <span className="text-2xl brightness-110 drop-shadow-md">⚡</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300 tracking-tight">TapSwap</h1>
                            <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">Starknet ⟷ Taproot</p>
                        </div>
                    </div>

                    {/* Status Indicators & Actions */}
                    <div className="flex items-center gap-6">
                        {/* Connection Status */}
                        <div className="hidden md:flex items-center gap-2 bg-black/20 rounded-2xl px-3 py-2 border border-white/5 shadow-inner">
                            <StatusItem
                                connected={lncIsConnected}
                                label="LNC"
                                value={lncDisplay}
                                title="View Lightning Node Info"
                                onClick={onOpenNodeModal}
                            />

                            <div className="w-px h-9 bg-white/10"></div>

                            <StatusItem
                                connected={nostrConnected}
                                label="Nostr"
                                value={nostrDisplay}
                                title="View Nostr Identity"
                                onClick={onOpenNostrModal}
                            />

                            <div className="w-px h-9 bg-white/10"></div>

                            <StatusItem
                                connected={walletConnected}
                                label="Wallet"
                                value={walletDisplay}
                                title="Wallet status"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            {lncIsConnected && (
                                <button
                                    onClick={onOpenAdminModal}
                                    className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white rounded-xl transition duration-200 shadow-sm group"
                                    title="Admin Settings"
                                >
                                    <svg className="w-5 h-5 transition-transform duration-500 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                </button>
                            )}

                            <button
                                onClick={onOpenConnectModal}
                                className={`px-5 py-2.5 rounded-xl font-bold transition-all duration-300 shadow-lg flex items-center gap-2.5 transform hover:-translate-y-0.5 ${lncIsConnected && walletConnected
                                    ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/30'
                                    : 'bg-white hover:bg-indigo-50 text-indigo-900 border border-white'
                                    }`}
                            >
                                {lncIsConnected && walletConnected ? (
                                    <>
                                        <span>🚪</span> Logout
                                    </>
                                ) : (
                                    <>
                                        <span>🚀</span> Connect
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default Header;
