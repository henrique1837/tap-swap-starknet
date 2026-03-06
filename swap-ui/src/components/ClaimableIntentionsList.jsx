import React, { useState, useEffect, useCallback } from 'react';
import { useNostr } from '../contexts/NostrContext';
import { nip19 } from 'nostr-tools';

const normalizeWantedAsset = (value) => {
    if (!value || typeof value !== 'string') return 'STRK';
    const normalized = value.trim().toUpperCase();
    return normalized === 'TAPROOT_STRK' ? 'TAPROOT_STRK' : 'STRK';
};

const statusBadge = (status) => {
    if (status === 'open') return 'bg-emerald-500 text-white';
    if (status === 'accepted') return 'bg-blue-500 text-white';
    if (status === 'invoice_ready') return 'bg-violet-600 text-white';
    if (status === 'locked') return 'bg-purple-600 text-white';
    if (status === 'claimed') return 'bg-teal-600 text-white';
    if (status === 'refunded') return 'bg-orange-500 text-white';
    return 'bg-slate-400 text-white';
};

const ClaimableIntentionCard = ({ intention, onSelect, isSelected }) => {
    const npub = nip19.npubEncode(intention.pubkey || intention.posterPubkey);
    const acceptedByNpub = intention.acceptedByPubkey ? nip19.npubEncode(intention.acceptedByPubkey) : '';

    return (
        <div
            className={`bg-white/60 backdrop-blur-md rounded-2xl p-5 transition-all duration-300 border ${isSelected ? 'border-purple-500 shadow-lg ring-2 ring-purple-200/50 scale-[1.02]' : 'border-white hover:border-purple-200 hover:shadow-md'
                }`}
        >
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                        {intention.dTag?.substring(0, 2).toUpperCase()}
                    </div>
                    <h4 className="font-semibold text-slate-700 text-sm">
                        ID: {intention.dTag?.substring(0, 10)}...
                    </h4>
                </div>
                <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    {new Date(intention.created_at * 1000).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
                <div>
                    <span className="block text-slate-400 font-bold tracking-wider uppercase mb-1">Poster</span>
                    <span className="font-mono text-slate-700 truncate block" title={npub}>{npub.substring(0, 8)}...</span>
                </div>
                <div>
                    <span className="block text-slate-400 font-bold tracking-wider uppercase mb-1">Accepter</span>
                    <span className="font-mono text-slate-700 truncate block" title={acceptedByNpub}>{acceptedByNpub.substring(0, 8)}...</span>
                </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-100 mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold tracking-wider text-purple-400 uppercase">Receiving</span>
                    <span className="text-sm font-bold text-indigo-700">{intention.wantedAsset || 'STRK Native'}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                    <span className="font-bold text-slate-800">{intention.amountSTRK} STRK</span>
                    <span className="text-slate-400 mx-2">⟷</span>
                    <span className="font-bold text-emerald-600">{intention.amountSats} Sats</span>
                </div>
            </div>

            <div className="flex items-center justify-between text-xs mb-4">
                <span className="text-slate-500 font-medium">Status:</span>
                <span className={`font-bold px-2.5 py-1 rounded-full text-[11px] uppercase tracking-wide ${statusBadge(intention.status)}`}>
                    {intention.status}
                </span>
            </div>

            <div className="flex pt-2">
                <button
                    onClick={() => onSelect(intention)}
                    className={`w-full py-3 px-4 rounded-xl text-sm font-bold transition-all shadow-sm ${isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                        : 'bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 hover:shadow-md'
                        }`}
                >
                    {isSelected ? 'Processing This Swap' : 'Select to Claim'}
                </button>
            </div>
        </div>
    );
};

function ClaimableIntentionsList({
    setSelectedSwapIntention,
    selectedSwapIntention,
    setInvoicePaymentRequest,
    setInvoicePaymentHash,
    setErrorMessage,
    setSwapStatus,
    nostrPubkey,
    claimedSwapDTags = []
}) {
    const { fetchSwapIntentions } = useNostr();
    const [swapIntentions, setSwapIntentions] = useState([]);
    const [isFetchingIntentions, setIsFetchingIntentions] = useState(false);

    const fetchAndSetSwapIntentions = useCallback(async () => {
        if (!nostrPubkey) {
            setSwapIntentions([]);
            return;
        }

        setIsFetchingIntentions(true);
        try {
            const fetchedIntentions = await fetchSwapIntentions();
            // Filter intentions where the user is involved as the Claimer/Counterparty
            const claimable = fetchedIntentions.filter(intention => {
                // Filter out if already claimed locally
                if (claimedSwapDTags.includes(intention.dTag)) return false;

                // Determine user role in this intention
                const isPoster = intention.posterPubkey === nostrPubkey || intention.pubkey === nostrPubkey;
                const isAccepter = intention.acceptedByPubkey === nostrPubkey;

                if (!isPoster && !isAccepter) return false; // Not involved

                const wantedAsset = normalizeWantedAsset(intention.wantedAsset);
                const isClaimer = (wantedAsset === 'STRK' && isPoster) || (wantedAsset === 'TAPROOT_STRK' && isAccepter);

                if (!isClaimer) return false; // User is the Locker, not Claimer

                // Filter by status: must be ready for claiming steps
                // 'invoice_ready' means invoice is published, potentially STRK is locked (or about to be)
                // 'locked' (if we had specific status)
                return ['accepted', 'invoice_ready', 'locked'].includes(intention.status);
            });

            setSwapIntentions(claimable);
        } catch (err) {
            console.error('Error fetching claimable intentions:', err);
            setErrorMessage(`Failed to load intentions: ${err.message || String(err)}`);
        } finally {
            setIsFetchingIntentions(false);
        }
    }, [fetchSwapIntentions, nostrPubkey, setErrorMessage]);

    useEffect(() => {
        fetchAndSetSwapIntentions();
    }, [fetchAndSetSwapIntentions]);

    return (
        <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-4 mb-8 border border-white/50">
            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-100 text-purple-600 p-3 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">My Claimable Swaps</h2>
                        <p className="text-sm text-slate-500 font-medium">Swaps where you need to claim funds.</p>
                    </div>
                </div>
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
                    <span className="hidden sm:inline">{isFetchingIntentions ? 'Refreshing...' : 'Refresh'}</span>
                </button>
            </div>

            <div className="space-y-4">
                {!isFetchingIntentions && swapIntentions.length === 0 && (
                    <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                        <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        <p className="text-slate-500 font-medium">No active swaps found where you need to claim.</p>
                        <p className="text-xs text-slate-400 mt-1">Create or accept a swap first, wait for the counterparty to lock funds.</p>
                    </div>
                )}

                {swapIntentions.map((intention) => (
                    <ClaimableIntentionCard
                        key={intention.dTag || intention.id}
                        intention={intention}
                        onSelect={(intent) => {
                            setSelectedSwapIntention(intent);
                            if (intent.paymentRequest) setInvoicePaymentRequest(intent.paymentRequest);
                            if (intent.paymentHash) setInvoicePaymentHash(intent.paymentHash);
                            setSwapStatus(`Selected swap ${intent.dTag?.substring(0, 8)}... for claiming.`);
                        }}
                        isSelected={selectedSwapIntention?.dTag === intention.dTag}
                    />
                ))}
            </div>
        </div>
    );
}

export default ClaimableIntentionsList;
