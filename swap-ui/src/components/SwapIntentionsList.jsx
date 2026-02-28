import React, { useState, useEffect, useCallback } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { nip19 } from 'nostr-tools';

const statusClass = (status) => {
  if (status === 'invoice_ready') return 'text-emerald-600';
  if (status === 'accepted') return 'text-blue-600';
  if (status === 'open') return 'text-green-600';
  return 'text-gray-500';
};

const SimpleSwapIntentionCard = ({ intention, onSelect, isSelected, onAccept, canAccept }) => {
  const npub = nip19.npubEncode(intention.pubkey || intention.posterPubkey);

  return (
    <div
      className={`bg-white/60 backdrop-blur-md rounded-2xl p-5 transition-all duration-300 border ${isSelected ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200/50 scale-[1.02]' : 'border-white hover:border-indigo-200 hover:shadow-md'
        }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
            {npub.substring(5, 7).toUpperCase()}
          </div>
          <h4 className="font-semibold text-slate-700 text-sm">
            {npub.substring(0, 12) + '...'}
          </h4>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
          {new Date(intention.created_at * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Offering</span>
          <span className="text-sm font-bold text-slate-800">{intention.amountSTRK} STRK</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold tracking-wider text-slate-400 uppercase">Requesting</span>
          <span className="text-sm font-bold text-emerald-600">{intention.amountSats} Sats</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Wanted Asset:</span>
          <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{intention.wantedAsset || 'STRK Native'}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">Status:</span>
          <span className={`font-bold px-2 py-0.5 rounded ${statusClass(intention.status)} bg-opacity-10 bg-current`}>
            {intention.status || 'open'}
          </span>
        </div>

        {intention.acceptedByPubkey && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Accepter:</span>
            <span className="font-mono text-slate-600 truncate max-w-[120px]" title={nip19.npubEncode(intention.acceptedByPubkey)}>
              {nip19.npubEncode(intention.acceptedByPubkey).substring(0, 10)}...
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => onSelect(intention)}
          className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-bold transition-all ${isSelected
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}
          `}
        >
          {isSelected ? '✓ Selected' : 'Select'}
        </button>

        {canAccept && intention.status === 'open' && (
          <button
            onClick={() => onAccept(intention)}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-sm font-bold shadow-md hover:shadow-lg transition-all"
          >
            Accept Swap
          </button>
        )}
      </div>
    </div>
  );
};

function SwapIntentionsList({
  setSelectedSwapIntention,
  selectedSwapIntention,
  setInvoicePaymentRequest,
  setInvoicePaymentHash,
  setErrorMessage,
  setSwapStatus,
  starknetAddress,
  allowSelfAccept,
}) {
  const { nostrPubkey, fetchSwapIntentions, acceptSwapIntention } = useNostr();
  const [swapIntentions, setSwapIntentions] = useState([]);
  const [isFetchingIntentions, setIsFetchingIntentions] = useState(false);

  const fetchAndSetSwapIntentions = useCallback(async () => {
    // Guests can fetch intentions too
    setIsFetchingIntentions(true);
    try {
      const fetchedIntentions = await fetchSwapIntentions();

      // Filter intentions
      const filteredIntentions = fetchedIntentions.filter((intention) => {
        // 1. Fully open intentions should be visible to everyone
        if (intention.status === 'open') {
          return true;
        }

        // 2. If it is NOT open (accepted, invoice_ready, etc.), 
        // it should only be visible to the original poster or the accepter.
        if (nostrPubkey) {
          const posterPubkey = intention.posterPubkey || intention.pubkey;
          const isPoster = nostrPubkey === posterPubkey;
          const isAccepter = intention.acceptedByPubkey === nostrPubkey;
          if (isPoster || isAccepter) {
            return true; // Partially or fully involved user sees it
          }
        }

        // Otherwise hide it
        return false;
      });

      setSwapIntentions(filteredIntentions);
    } catch (err) {
      console.error('Error fetching swap intentions:', err);
      setErrorMessage(`Failed to load swap intentions: ${err.message || String(err)}`);
    } finally {
      setIsFetchingIntentions(false);
    }
  }, [fetchSwapIntentions, nostrPubkey, setErrorMessage]);

  useEffect(() => {
    fetchAndSetSwapIntentions();
  }, [fetchAndSetSwapIntentions]);

  const handleSelectIntention = useCallback((intention) => {
    setSelectedSwapIntention(intention);
    // Sticky updates: Only overwrite if new data is present. 
    // This prevents stale Nostr data from clearing locally generated invoices.
    if (intention.paymentRequest) setInvoicePaymentRequest(intention.paymentRequest);
    if (intention.paymentHash) setInvoicePaymentHash(intention.paymentHash);
    setErrorMessage('');
    setSwapStatus(`Selected intention from ${nip19.npubEncode(intention.pubkey || intention.posterPubkey).substring(0, 10)}...`);
  }, [setSelectedSwapIntention, setInvoicePaymentRequest, setInvoicePaymentHash, setErrorMessage, setSwapStatus]);

  const handleAcceptIntention = useCallback(async (intention) => {
    try {
      setErrorMessage('');
      setSwapStatus('Publishing acceptance to Nostr...');
      await acceptSwapIntention(intention, starknetAddress || '');
      setSwapStatus('Intention accepted. Swap can start.');
      await fetchAndSetSwapIntentions();
    } catch (err) {
      console.error('Error accepting intention:', err);
      setErrorMessage(`Failed to accept intention: ${err.message || String(err)}`);
    }
  }, [acceptSwapIntention, starknetAddress, fetchAndSetSwapIntentions, setErrorMessage, setSwapStatus]);

  return (
    <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-8 border border-white/50">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Marketplace</h2>
          <p className="text-sm text-slate-500 font-medium">Browse swap intentions or select accepted ones.</p>
        </div>
      </div>

      {allowSelfAccept && (
        <div className="mt-4 mb-6 flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div className="text-amber-500 mt-0.5">⚠️</div>
          <div>
            <p className="text-sm font-bold text-amber-800">Test Mode Enabled</p>
            <p className="text-xs text-amber-700">You can accept your own intentions for testing.</p>
          </div>
        </div>
      )}

      {!nostrPubkey && (
        <div className="mt-4 mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-[1px]">
          <div className="absolute inset-0 bg-white/20 backdrop-blur-3xl"></div>
          <div className="relative bg-white/95 p-5 rounded-2xl flex items-center gap-4">
            <div className="text-3xl">👋</div>
            <div>
              <p className="font-bold text-indigo-900">Exploring as Guest</p>
              <p className="text-xs text-indigo-700 mt-1">Login to accept swap intentions, or select one to explore.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4 mb-6">
        <button
          onClick={fetchAndSetSwapIntentions}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-xl transition duration-300 disabled:opacity-50 text-sm"
          disabled={isFetchingIntentions}
        >
          {isFetchingIntentions ? (
            <svg className="animate-spin h-4 w-4 text-slate-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          )}
          <span>{isFetchingIntentions ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      <div className="space-y-4">
        {swapIntentions.length === 0 && !isFetchingIntentions && (
          <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
            <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
            <p className="text-slate-500 font-medium">No active swap intentions found.</p>
            <p className="text-xs text-slate-400 mt-1">Check back later or create your own.</p>
          </div>
        )}

        {swapIntentions.map((intention) => {
          const isOwner = nostrPubkey === (intention.posterPubkey || intention.pubkey);
          const canAccept = Boolean(nostrPubkey) && intention.status === 'open' && (!isOwner || allowSelfAccept);

          return (
            <SimpleSwapIntentionCard
              key={intention.dTag || intention.id}
              intention={intention}
              onSelect={handleSelectIntention}
              isSelected={selectedSwapIntention?.dTag === intention.dTag}
              onAccept={handleAcceptIntention}
              canAccept={canAccept}
            />
          );
        })}
      </div>
    </div>
  );
}

export default SwapIntentionsList;
