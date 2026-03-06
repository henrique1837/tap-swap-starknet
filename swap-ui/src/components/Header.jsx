import React, { useState } from 'react';

function Header({
    lncIsConnected,
    nostrConnected,
    walletConnected,
    onOpenNostrModal,
    onOpenNodeModal,
    onOpenConnectModal,
    walletAddress
}) {
    const [showWalletTooltip, setShowWalletTooltip] = useState(false);

    const StatusDot = ({ connected, label }) => (
        <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse' : 'bg-rose-500'}`}></div>
            <span className="text-sm font-medium text-slate-300">{label}</span>
        </div>
    );

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
                        <div className="hidden md:flex items-center gap-5 bg-black/20 rounded-2xl px-5 py-2.5 border border-white/5 shadow-inner">
                            <button
                                onClick={onOpenNodeModal}
                                className="group hover:bg-white/10 rounded-lg px-2 py-1 transition-all duration-300"
                                title="View Lightning Node Info"
                            >
                                <StatusDot connected={lncIsConnected} label={<span className="text-slate-300 group-hover:text-white transition-colors">LNC</span>} />
                            </button>

                            <div className="w-px h-4 bg-white/10"></div>

                            <button
                                onClick={onOpenNostrModal}
                                className="group hover:bg-white/10 rounded-lg px-2 py-1 transition-all duration-300"
                                title="View Nostr Identity"
                            >
                                <StatusDot connected={nostrConnected} label={<span className="text-slate-300 group-hover:text-white transition-colors">Nostr</span>} />
                            </button>

                            <div className="w-px h-4 bg-white/10"></div>

                            <div className="relative">
                                <button
                                    onMouseEnter={() => setShowWalletTooltip(true)}
                                    onMouseLeave={() => setShowWalletTooltip(false)}
                                    className="group hover:bg-white/10 rounded-lg px-2 py-1 transition-all duration-300"
                                    title="Wallet Status"
                                >
                                    <StatusDot connected={walletConnected} label={<span className="text-slate-300 group-hover:text-white transition-colors">Wallet</span>} />
                                </button>

                                {showWalletTooltip && walletAddress && (
                                    <div className="absolute top-full right-0 mt-3 bg-slate-800 text-slate-200 text-xs font-mono rounded-xl px-4 py-2 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-top-2">
                                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={onOpenNodeModal}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 shadow-sm"
                                title="Lightning Node Info"
                            >
                                <span className="text-lg disabled:grayscale">⚡</span>
                            </button>

                            <button
                                onClick={onOpenNostrModal}
                                className="bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 px-3.5 py-2.5 rounded-xl font-medium transition-all duration-300 flex items-center gap-2 shadow-sm"
                                title="Nostr Identity"
                            >
                                <span className="text-lg">🔑</span>
                            </button>

                            <div className="h-8 w-px bg-white/10 mx-2"></div>

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
