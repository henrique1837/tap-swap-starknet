import React from 'react';

function CreateSwapIntention({
  handlePublishSwapIntention,
  nostrPubkey,
  swapStatus,
  SWAP_AMOUNT_TAP_SATOSHIS,
  swapAmountSTRK,
  wantedAsset,
  setWantedAsset,
}) {
  // Convert Wei string to a human-readable STRK amount (18 decimals)
  const strkDisplay = (() => {
    try {
      const wei = BigInt(swapAmountSTRK);
      const whole = wei / 10n ** 18n;
      const frac = wei % 10n ** 18n;
      if (frac === 0n) return `${whole}`;
      const fracStr = frac.toString().padStart(18, '0').replace(/0+$/, '');
      return `${whole}.${fracStr}`;
    } catch { return swapAmountSTRK; }
  })();
  return (
    <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl border border-white/50 w-full max-w-2xl mt-8 transition-all hover:shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Create Swap Offer</h2>
          <p className="text-sm text-slate-500 font-medium">Post your intention to the Nostr network</p>
        </div>
      </div>

      <div className="mb-6 p-5 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-2xl border border-indigo-100/50">
        {wantedAsset === 'TAPROOT_STRK' ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">You Offer</span>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-800">{strkDisplay} STRK</span>
                <p className="text-[10px] text-slate-400">{swapAmountSTRK} Wei</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">You Request</span>
              <div className="text-right">
                <span className="text-lg font-bold text-amber-600">{SWAP_AMOUNT_TAP_SATOSHIS} units</span>
                <p className="text-[10px] text-slate-400">Taproot STRK asset</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">You Offer</span>
              <div className="text-right">
                <span className="text-lg font-bold text-emerald-600">{SWAP_AMOUNT_TAP_SATOSHIS} units</span>
                <p className="text-[10px] text-slate-400">Taproot asset</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider">You Request</span>
              <div className="text-right">
                <span className="text-lg font-bold text-slate-800">{strkDisplay} STRK</span>
                <p className="text-[10px] text-slate-400">{swapAmountSTRK} Wei</p>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mb-8">
        <label className="block text-sm font-bold text-slate-700 mb-3" htmlFor="wanted-asset">
          Select Wanted Asset
        </label>
        <div className="relative">
          <select
            id="wanted-asset"
            value={wantedAsset}
            onChange={(e) => setWantedAsset(e.target.value)}
            className="w-full p-4 pl-5 pr-10 border border-slate-200 rounded-xl bg-white/50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none transition-all hover:border-indigo-300"
          >
            <option value="STRK">STRK Native</option>
            <option value="TAPROOT_STRK">Taproot STRK</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      <button
        onClick={handlePublishSwapIntention}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
        disabled={!nostrPubkey || swapStatus.includes('Publishing')}
      >
        <span>Broadcast Intention</span>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
      </button>
    </div>
  );
}

export default CreateSwapIntention;
