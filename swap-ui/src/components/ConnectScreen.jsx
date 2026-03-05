import React from 'react';

// Icon mapping for known wallets
function WalletIcon({ connectorId }) {
  const id = (connectorId || '').toLowerCase();
  if (id.includes('braavos')) return <span className="text-2xl">🦁</span>;
  if (id.includes('argent')) return <span className="text-2xl">🌿</span>;
  return <span className="text-2xl">💼</span>;
}

function ConnectScreen({
  pairingPhrase,
  setPairingPhrase,
  lncPassword,
  setLncPassword,
  isConnectingLNC,
  handleConnectLNCWithPairing,
  handleLoginLNCWithPassword,
  handleDisconnectLNC,
  handleLogoutLNC,
  connectionErrorLNC,
  isWalletConnected,
  walletAddress,
  walletNetwork,
  walletType,
  isConnectingWallet,
  onConnectWallet,
  onDisconnectWallet,
  connectionErrorWallet,
  lncIsPaired,
  lncIsConnected,
  onExploreAsGuest,
  availableConnectors,
}) {
  const onLncConnect = () => {
    if (lncIsPaired) {
      handleLoginLNCWithPassword(lncPassword);
    } else {
      handleConnectLNCWithPairing(pairingPhrase, lncPassword);
    }
  };

  return (
    <div className="w-full relative overflow-hidden -m-6 p-6">
      {/* Ambient background glow */}
      <div className="absolute top-0 left-1/4 w-1/2 h-32 bg-indigo-500/20 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-1/2 h-40 bg-rose-500/20 blur-[100px] pointer-events-none"></div>

      <div className="relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 border border-white/10 mb-6 shadow-lg shadow-indigo-500/10">
            <span className="text-3xl brightness-125 drop-shadow-md">⚡</span>
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">Connection Center</h1>
          <p className="text-sm text-slate-400 mt-3 font-medium">Link your nodes to begin swapping</p>
        </div>

        <div className="space-y-6">
          {/* LNC Connection Section */}
          <div className={`overflow-hidden border rounded-2xl transition-all duration-300 ${lncIsConnected ? 'bg-indigo-500/5 border-indigo-500/20 shadow-[0_0_30px_-5px_rgba(99,102,241,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'}`}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-3">
                <span className="text-indigo-400 text-xl">⚡</span> Lightning Node
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-slate-400 font-mono tracking-widest">LNC</span>
              </h2>
              {lncIsConnected ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
                </span>
              ) : null}
            </div>

            <div className="p-6">
              {isConnectingLNC ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-indigo-500/30 border-t-indigo-400"></div>
                  <p className="mt-4 text-indigo-400 text-sm font-semibold tracking-wide">Establishing LNC Tunnel...</p>
                </div>
              ) : lncIsConnected ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center gap-4">
                    <div className="bg-emerald-500/20 text-emerald-400 rounded-full p-2 text-xs border border-emerald-500/30">✓</div>
                    <div>
                      <p className="text-emerald-400 font-bold text-sm tracking-wide">Node Connection Secure</p>
                      <p className="text-emerald-500/70 text-xs mt-0.5">Ready for invoices & payments</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDisconnectLNC}
                    className="w-full py-3.5 px-4 rounded-xl text-slate-300 text-sm font-bold transition-all bg-white/5 hover:bg-white/10 border border-white/10 hover:text-white"
                  >
                    Disconnect Node
                  </button>
                </div>
              ) : lncIsPaired ? (
                <div className="space-y-5">
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mb-2 pl-1">Unlock Session</label>
                    <input
                      type="password"
                      value={lncPassword}
                      onChange={setLncPassword}
                      placeholder="Enter session password"
                      className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl text-slate-300 placeholder:text-slate-600 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all shadow-inner text-sm"
                      disabled={isConnectingLNC}
                    />
                  </div>
                  <button
                    onClick={onLncConnect}
                    className={`w-full py-3.5 px-4 rounded-xl text-white text-sm font-bold transition-all flex justify-center items-center gap-2 transform hover:-translate-y-0.5 ${lncPassword && !isConnectingLNC
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 shadow-lg shadow-indigo-500/25 border border-indigo-400/20'
                      : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                      }`}
                    disabled={!lncPassword || isConnectingLNC}
                  >
                    Connect to Node
                  </button>
                  <button
                    onClick={handleLogoutLNC}
                    className="w-full py-2 text-xs text-slate-500 hover:text-rose-400 font-medium transition-colors"
                  >
                    Clear pairing and start over
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[11px] text-indigo-300/80 font-medium leading-relaxed">
                    <span className="text-indigo-400 mr-2">ℹ️</span> Pair your node using a phrase from <code className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">Terminal</code> or <code className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-mono">Polar</code>.
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mb-2 pl-1">Pairing Phrase</label>
                    <input
                      type="text"
                      value={pairingPhrase}
                      onChange={setPairingPhrase}
                      placeholder="e.g. apple banana cherry..."
                      className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl text-slate-300 placeholder:text-slate-600 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all shadow-inner text-sm"
                      disabled={isConnectingLNC}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest mb-2 pl-1">Set Password</label>
                    <input
                      type="password"
                      value={lncPassword}
                      onChange={setLncPassword}
                      placeholder="Create a password for this session"
                      className="w-full p-3.5 bg-black/40 border border-white/10 rounded-xl text-slate-300 placeholder:text-slate-600 focus:bg-black/60 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none transition-all shadow-inner text-sm"
                      disabled={isConnectingLNC}
                    />
                  </div>
                  <button
                    onClick={onLncConnect}
                    className={`w-full py-4 px-4 rounded-xl text-white text-sm font-bold transition-all transform hover:-translate-y-0.5 ${pairingPhrase && lncPassword && !isConnectingLNC
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 shadow-[0_0_20px_rgba(99,102,241,0.3)] border border-indigo-400/30'
                      : 'bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed'
                      }`}
                    disabled={!pairingPhrase || !lncPassword || isConnectingLNC}
                  >
                    Pair & Establish Connection
                  </button>
                </div>
              )}
              {connectionErrorLNC && (
                <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Connection Error</p>
                  <p className="text-xs text-rose-300/80 leading-relaxed">{connectionErrorLNC}</p>
                </div>
              )}
            </div>
          </div>

          {/* Starknet Wallet Section */}
          <div className={`overflow-hidden border rounded-2xl transition-all duration-300 ${isWalletConnected ? 'bg-orange-500/5 border-orange-500/20 shadow-[0_0_30px_-5px_rgba(249,115,22,0.1)]' : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'}`}>
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-200 flex items-center gap-3">
                <span className="text-orange-400 text-xl grayscale-[0.2]">🦊</span> Starknet Wallet
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/10 text-slate-400 font-mono tracking-widest hidden sm:inline-block">WEB3</span>
              </h2>
              {isWalletConnected ? (
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Connected
                </span>
              ) : null}
            </div>

            <div className="p-6">
              {isWalletConnected ? (
                <div className="space-y-4">
                  <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-tr from-emerald-400 to-teal-400 text-slate-900 rounded-full p-2 text-sm shadow-lg shadow-emerald-500/20 font-bold border border-emerald-300/50">✨</div>
                      <div>
                        <p className="text-emerald-400 font-bold text-sm tracking-wide">Connection Active</p>
                        <p className="text-emerald-500/70 text-[10px] font-medium uppercase tracking-widest mt-0.5">Starknet account ready</p>
                      </div>
                    </div>
                    <div className="bg-black/30 p-3.5 rounded-lg border border-white/5">
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 pl-1">Active Address</label>
                      <p className="text-sm text-slate-300 font-mono break-all pl-1">{walletAddress}</p>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-medium text-slate-400 tracking-wider">NETWORK: <span className="text-slate-300 font-bold">{walletNetwork || 'Unknown'}</span></span>
                      <span className="text-[10px] font-medium text-slate-400 tracking-wider">TYPE: <span className="text-slate-300 font-bold">{walletType || 'software'}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={onDisconnectWallet}
                    className="w-full py-3.5 px-4 rounded-xl text-slate-300 text-sm font-bold transition-all bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 hover:text-rose-400 flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">🚪</span> Disconnect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {availableConnectors && availableConnectors.length > 0 ? (
                    <>
                      <p className="text-xs text-slate-400 text-center font-medium mb-2 tracking-wide">Select your provider</p>
                      <div className="grid grid-cols-1 gap-3">
                        {availableConnectors.map((connector) => (
                          <button
                            key={connector.id}
                            onClick={() => onConnectWallet(connector)}
                            disabled={isConnectingWallet}
                            className="w-full py-3.5 px-5 rounded-xl text-slate-200 text-sm font-bold transition-all border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 flex items-center justify-between group disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1.5 bg-black/30 rounded-lg group-hover:scale-110 transition-transform">
                                <WalletIcon connectorId={connector.id} />
                              </div>
                              <span className="tracking-wide text-slate-300 group-hover:text-white transition-colors">
                                {connector.name || connector.id}
                              </span>
                            </div>
                            <span className="text-indigo-400/50 group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transform duration-300">→</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center p-6 bg-white/5 rounded-xl border border-white/5">
                      <div className="text-4xl mb-3 opacity-50 grayscale">🦊</div>
                      <p className="text-sm text-slate-300 font-medium mb-2">No Wallet Detected</p>
                      <p className="text-xs text-slate-500">Please install Braavos or Argent X to continue.</p>
                    </div>
                  )}
                </div>
              )}
              {connectionErrorWallet && (
                <div className="mt-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                  <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider mb-1">Wallet Error</p>
                  <p className="text-xs text-rose-300/80 leading-relaxed">{connectionErrorWallet}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Guest / Continue Button */}
        <div className="mt-10 flex flex-col items-center">
          <button
            onClick={onExploreAsGuest}
            className={`group flex flex-col items-center justify-center p-4 w-full rounded-2xl border transition-all duration-500 ${lncIsConnected && isWalletConnected ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 hover:border-emerald-500/50 transform hover:-translate-y-1 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'bg-transparent border-transparent hover:bg-white/5'}`}
          >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-all duration-500 ${lncIsConnected && isWalletConnected ? 'bg-emerald-500 text-slate-900 shadow-lg shadow-emerald-500/30' : 'bg-white/10 text-slate-400 group-hover:bg-white/20 group-hover:text-white'}`}>
              {lncIsConnected && isWalletConnected ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
              )}
            </div>
            <span className={`font-bold transition-colors tracking-wide ${lncIsConnected && isWalletConnected ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
              {lncIsConnected && isWalletConnected ? 'ENTER APP' : 'CONTINUE AS GUEST'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectScreen;
