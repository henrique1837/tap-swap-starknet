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
    <div className="p-2 bg-white">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Connection Center</h1>
        <p className="text-sm text-slate-500 mt-2">Connect your Lightning node and Starknet Wallet</p>
      </div>

      {/* LNC Connection Section */}
      <div className="mb-6 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm transition-all hover:shadow-md">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="text-indigo-600">⚡</span> Lightning Node (LNC)
          </h2>
          {lncIsConnected && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Active</span>}
        </div>

        <div className="p-6">
          {isConnectingLNC ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
              <p className="mt-4 text-indigo-600 font-semibold animate-pulse">Establishing LNC Tunnel...</p>
            </div>
          ) : lncIsConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex items-center gap-3">
                <div className="bg-green-500 text-white rounded-full p-1 text-xs">✓</div>
                <p className="text-green-800 font-semibold">Node Connection Secure</p>
              </div>
              <button
                onClick={handleDisconnectLNC}
                className="w-full py-3 px-4 rounded-xl text-white font-bold transition-all bg-slate-800 hover:bg-slate-900 shadow-lg hover:shadow-slate-200"
              >
                Disconnect Node
              </button>
            </div>
          ) : lncIsPaired ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Unlock Session</label>
                <input
                  type="password"
                  value={lncPassword}
                  onChange={setLncPassword}
                  placeholder="Enter session password"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  disabled={isConnectingLNC}
                />
              </div>
              <button
                onClick={onLncConnect}
                className={`w-full py-3 px-4 rounded-xl text-white font-bold transition-all ${lncPassword && !isConnectingLNC
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                disabled={!lncPassword || isConnectingLNC}
              >
                Connect to Node
              </button>
              <button
                onClick={handleDisconnectLNC}
                className="w-full py-2 text-xs text-slate-400 hover:text-red-500 font-medium transition-colors"
              >
                Clear pairing and start over
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-indigo-50 rounded-lg text-[11px] text-indigo-700 font-medium leading-relaxed">
                ℹ️ Pair your node once using a phrase from <code className="bg-indigo-100 px-1 rounded text-indigo-900 font-bold">Terminal</code> or <code className="bg-indigo-100 px-1 rounded text-indigo-900 font-bold">Polar</code>.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Pairing Phrase</label>
                <input
                  type="text"
                  value={pairingPhrase}
                  onChange={setPairingPhrase}
                  placeholder="e.g. apple banana cherry..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  disabled={isConnectingLNC}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Set Password</label>
                <input
                  type="password"
                  value={lncPassword}
                  onChange={setLncPassword}
                  placeholder="Create a password for this session"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  disabled={isConnectingLNC}
                />
              </div>
              <button
                onClick={onLncConnect}
                className={`w-full py-3 px-4 rounded-xl text-white font-bold transition-all ${pairingPhrase && lncPassword && !isConnectingLNC
                  ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 text-lg'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                disabled={!pairingPhrase || !lncPassword || isConnectingLNC}
              >
                Pair & Establish Connection
              </button>
            </div>
          )}
          {connectionErrorLNC && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-[11px] font-bold text-red-700 uppercase mb-1">Connection Error</p>
              <p className="text-xs text-red-600 leading-snug">{connectionErrorLNC}</p>
            </div>
          )}
        </div>
      </div>

      {/* Starknet Wallet Section */}
      <div className="mb-10 overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm transition-all hover:shadow-md">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span className="text-orange-500 text-xl">🦊</span> Starknet Wallet (Braavos/Argent)
          </h2>
          {isWalletConnected && <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">Connected</span>}
        </div>

        <div className="p-6">
          {isWalletConnected ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200 flex items-center gap-3 animate-pulse">
                <div className="bg-green-500 text-white rounded-full p-2 text-sm shadow-lg shadow-green-100 italic">✨</div>
                <div>
                  <p className="text-green-800 font-extrabold text-sm">Connection Active!</p>
                  <p className="text-green-600 text-[10px] font-medium uppercase tracking-tighter">Your Starknet account is ready</p>
                </div>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Address</label>
                <p className="text-sm text-slate-800 font-mono break-all font-bold">
                  {walletAddress}
                </p>
                <div className="mt-3 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-500 italic">Network: {walletNetwork || 'Unknown'}</span>
                  <span className="text-xs font-bold text-slate-500 italic">Type: {walletType || 'software'}</span>
                </div>
              </div>
              <button
                onClick={onDisconnectWallet}
                className="w-full py-3 px-4 rounded-xl text-white font-bold transition-all bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100 flex items-center justify-center gap-2"
              >
                <span>🚪</span> Disconnect Wallet
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {availableConnectors && availableConnectors.length > 0 ? (
                <>
                  <p className="text-xs text-slate-500 text-center font-medium mb-1">Select your Starknet wallet:</p>
                  {availableConnectors.map((connector) => (
                    <button
                      key={connector.id}
                      onClick={() => onConnectWallet(connector)}
                      disabled={isConnectingWallet}
                      className="w-full py-3 px-6 rounded-2xl text-white font-extrabold text-base transition-all shadow-lg bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500 hover:scale-[1.02] active:scale-[0.98] shadow-orange-100 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <WalletIcon connectorId={connector.id} />
                      <span>
                        {isConnectingWallet ? 'Connecting...' : `Connect ${connector.name || connector.id}`}
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <button
                    onClick={() => onConnectWallet()}
                    disabled={isConnectingWallet}
                    className="w-full py-4 px-6 rounded-2xl text-white font-extrabold text-lg transition-all shadow-xl bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500 hover:scale-[1.02] active:scale-[0.98] shadow-orange-100 flex items-center justify-center gap-3 disabled:opacity-60"
                  >
                    <span>{isConnectingWallet ? 'Connecting Wallet...' : 'Connect Starknet Wallet'}</span>
                  </button>
                  <p className="text-xs text-slate-500 text-center">
                    No wallet detected. Make sure Braavos is installed and enabled.
                  </p>
                </>
              )}
            </div>

          )}
          {connectionErrorWallet && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-[11px] font-bold text-red-700 uppercase mb-1">Wallet Error</p>
              <p className="text-xs text-red-600 leading-snug">{connectionErrorWallet}</p>
            </div>
          )}
        </div>
      </div>

      {/* Guest Option */}
      <div className="py-6 border-t border-slate-100 flex flex-col items-center">
        <p className="text-xs text-slate-400 mb-4 font-medium italic">
          {lncIsConnected && isWalletConnected
            ? "You're all set! Ready to start swapping."
            : "Connect your tools to begin."}
        </p>
        <button
          onClick={onExploreAsGuest}
          className="group relative px-6 py-2 bg-white text-slate-600 hover:text-indigo-600 font-bold text-sm transition-all"
        >
          <span>{lncIsConnected && isWalletConnected ? "Enter App" : "Continue as Guest"}</span>
          <div className="absolute bottom-1.5 left-6 right-6 h-[2px] bg-slate-200 group-hover:bg-indigo-500 transition-colors"></div>
        </button>
      </div>
    </div>
  );
}

export default ConnectScreen;
