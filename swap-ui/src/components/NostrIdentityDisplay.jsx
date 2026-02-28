import React, { useState } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { nip19 } from 'nostr-tools';

function NostrIdentityDisplay() {
  const { nostrPubkey, nostrPrivkey, isLoadingNostr } = useNostr();
  const [copiedField, setCopiedField] = useState(null);
  const [showPrivKey, setShowPrivKey] = useState(false);

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const privKeyHex = nostrPrivkey ? Buffer.from(nostrPrivkey).toString('hex') : '';
  const nsec = nostrPrivkey ? nip19.nsecEncode(nostrPrivkey) : '';

  const CopyButton = ({ text, field, label, isAmber = false }) => (
    <button
      onClick={() => copyToClipboard(text, field)}
      className={`ml-2 px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider rounded-lg transition duration-200 flex items-center gap-1.5 ${isAmber ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400' : 'bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300'}`}
      title={`Copy ${label}`}
    >
      {copiedField === field ? (
        <>
          <span className="text-emerald-400">✓</span>
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <span>📋</span>
          <span>Copy</span>
        </>
      )}
    </button>
  );

  return (
    <div className="space-y-6">
      {isLoadingNostr ? (
        <div className="flex items-center gap-4 p-5 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl shadow-inner">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400"></div>
          <p className="text-indigo-300 font-bold tracking-wide text-sm">Deriving Nostr keys from LNC...</p>
        </div>
      ) : nostrPubkey ? (
        <div className="space-y-5">
          {/* Status Banner */}
          <div className="flex items-center gap-4 p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
            <p className="text-emerald-400 font-bold tracking-wide text-sm">Nostr Identity Ready</p>
          </div>

          {/* Public Key Info */}
          <div className="bg-white/5 p-6 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Public Key (Hex)</label>
              <CopyButton text={nostrPubkey} field="pubkey" label="Public Key" />
            </div>
            <p className="text-[11px] text-slate-300 font-mono break-all bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
              {nostrPubkey}
            </p>

            <div className="flex items-center justify-between mt-6 mb-3">
              <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Npub (Bech32)</label>
              <CopyButton text={nip19.npubEncode(nostrPubkey)} field="npub" label="Npub" />
            </div>
            <p className="text-[11px] text-slate-300 font-mono break-all bg-black/40 p-4 rounded-xl border border-white/5 shadow-inner">
              {nip19.npubEncode(nostrPubkey)}
            </p>
          </div>

          {/* Private Key Info - High Security */}
          <div className="bg-amber-500/5 p-6 rounded-2xl border border-amber-500/10 shadow-[0_4px_20px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <label className="text-xs font-bold text-amber-500 flex items-center gap-2 uppercase tracking-widest">
                <span>🔐</span> Private Key (Secret)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPrivKey(!showPrivKey)}
                  className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-4 py-1.5 rounded-lg transition-colors"
                >
                  {showPrivKey ? 'Hide' : 'Reveal'}
                </button>
                {showPrivKey && <CopyButton text={nsec} field="nsec" label="Nsec" isAmber={true} />}
              </div>
            </div>
            {showPrivKey ? (
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <p className="text-[9px] text-amber-500/70 uppercase font-bold tracking-widest mb-1.5">Nsec format:</p>
                  <p className="text-[11px] text-rose-400 font-mono break-all bg-rose-950/30 p-4 rounded-xl border border-rose-500/20 shadow-inner">
                    {nsec}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] text-amber-500/70 uppercase font-bold tracking-widest mb-1.5">Hex format:</p>
                  <p className="text-[11px] text-rose-400 font-mono break-all bg-rose-950/30 p-4 rounded-xl border border-rose-500/20 shadow-inner">
                    {privKeyHex}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-14 bg-amber-500/5 rounded-xl border border-dashed border-amber-500/20 flex items-center justify-center transition-colors hover:bg-amber-500/10 cursor-pointer" onClick={() => setShowPrivKey(true)}>
                <p className="text-xs font-bold text-amber-500/50 uppercase tracking-widest flex items-center gap-2">
                  <span>👀</span> Click to reveal
                </p>
              </div>
            )}
            <div className="mt-5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <p className="text-[10px] text-rose-400 leading-relaxed uppercase tracking-wider font-bold">
                <span className="text-rose-500 mr-1">WARNING:</span> Never share your private key. Anyone with this key can control your Nostr identity and swap history.
              </p>
            </div>
          </div>

          {/* Info */}
          <div className="p-5 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl shadow-inner">
            <p className="text-[11px] text-indigo-300/80 leading-relaxed font-medium">
              <span className="font-bold text-indigo-300 block mb-1 uppercase tracking-widest text-[10px]">ℹ️ Deterministic Identity</span>
              Your keys are derived from your LNC session signature.
              This means as long as you use the same Lightning wallet to sign, you'll have the same identity.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-rose-500/5 border border-rose-500/10 rounded-3xl text-center shadow-inner">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-rose-500/20 mb-4">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-rose-400 font-bold text-lg mb-2 tracking-tight">Identity Not Found</p>
          <p className="text-sm text-rose-400/70 font-medium">
            Please connect your Lightning Node (LNC) first. Your identity will be derived automatically.
          </p>
        </div>
      )}
    </div>
  );
}

export default NostrIdentityDisplay;
