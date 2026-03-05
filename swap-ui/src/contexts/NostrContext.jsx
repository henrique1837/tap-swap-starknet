import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { SimplePool } from 'nostr-tools/pool';
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure';
import { nip19 } from 'nostr-tools';
import { Buffer } from 'buffer';
import { sha256 } from 'ethereum-cryptography/sha256';

if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = Buffer;
}

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

export const NOSTR_SWAP_INTENTION_KIND = 30079; // NIP-33 intention (poster-owned)
export const NOSTR_SWAP_ACCEPT_KIND = 30080; // acceptance events
export const NOSTR_SWAP_INVOICE_KIND = 30081; // invoice publication events
export const NOSTR_SWAP_CLAIM_KIND = 30082; // claim publication events
export const NOSTR_SWAP_TOPIC = 'tap-strk-swap';

const NostrContext = createContext(null);

const toHex = (bytes) => Buffer.from(bytes).toString('hex');
const extractTagValue = (tags, key) => tags.find((tag) => tag[0] === key)?.[1];
const normalizeWantedAsset = (value) => {
  if (!value || typeof value !== 'string') return 'STRK';
  const normalized = value.trim().toUpperCase();
  return normalized === 'TAPROOT_STRK' ? 'TAPROOT_STRK' : 'STRK';
};
const extractDTagFromARef = (aRef) => {
  if (!aRef) return null;
  const parts = aRef.split(':');
  return parts.length >= 3 ? parts.slice(2).join(':') : null;
};

export const NostrProvider = ({ children }) => {
  const [pool] = useState(() => new SimplePool());
  const [privKey, setPrivKey] = useState(null);
  const [nostrPubkey, setNostrPubkey] = useState(null);
  const [isLoadingNostr, setIsLoadingNostr] = useState(false);

  const disconnectNostr = useCallback(() => {
    setNostrPubkey(null);
    setPrivKey(null);
    setIsLoadingNostr(false);
  }, []);

  const deriveNostrKeyFromSignature = useCallback(async (signatureHex) => {
    const hash = sha256(Buffer.from(signatureHex.replace(/^0x/, ''), 'hex'));
    return new Uint8Array(hash);
  }, []);

  const deriveNostrKeysFromLNC = useCallback(async (signMessageFunction) => {
    if (nostrPubkey) return;

    setIsLoadingNostr(true);
    try {
      const messageToSign = 'Sign this message to derive your Nostr identity for LNC Atomic Swaps.';
      const signature = await signMessageFunction(messageToSign);
      if (!signature) throw new Error('LNC message signature cancelled or failed.');

      const sk = await deriveNostrKeyFromSignature(signature);
      const pk = getPublicKey(sk);

      setPrivKey(sk);
      setNostrPubkey(pk);
      console.log('Generated NPUB:', nip19.npubEncode(pk));
    } catch (error) {
      console.error('Error deriving Nostr identity from LNC:', error);
      disconnectNostr();
    } finally {
      setIsLoadingNostr(false);
    }
  }, [nostrPubkey, deriveNostrKeyFromSignature, disconnectNostr]);

  const generateDTag = useCallback((posterPubkey, wantedAsset, amountSTRK, amountSats) => {
    const uniqueContent = `${posterPubkey}-${wantedAsset}-${amountSTRK}-${amountSats}-${Date.now()}-${Math.random()}`;
    return toHex(sha256(new TextEncoder().encode(uniqueContent)));
  }, []);

  const publishSwapIntention = useCallback(async (intentionDetails, starknetAddress) => {
    if (!nostrPubkey || !privKey) throw new Error('Nostr identity not established or private key unavailable.');

    const wantedAsset = normalizeWantedAsset(intentionDetails.wantedAsset);
    if (!['STRK', 'TAPROOT_STRK'].includes(wantedAsset)) {
      throw new Error('Invalid wantedAsset. Use STRK or TAPROOT_STRK.');
    }
    if (!intentionDetails.amountSTRK || !intentionDetails.amountSats) {
      throw new Error('Missing intention details (amountSTRK, amountSats).');
    }

    const dTagValue = generateDTag(
      nostrPubkey,
      wantedAsset,
      intentionDetails.amountSTRK,
      intentionDetails.amountSats,
    );

    const fullIntentionData = {
      dTag: dTagValue,
      posterPubkey: nostrPubkey,
      posterStarknetAddress: starknetAddress || '',
      status: 'open',
      wantedAsset,
      amountSTRK: intentionDetails.amountSTRK,
      amountSats: intentionDetails.amountSats,
      paymentRequest: '',
      paymentHash: '',
      contractAddress: intentionDetails.contractAddress || '',
      timelock: intentionDetails.timelock || null,
    };

    const tags = [
      ['d', dTagValue],
      ['t', NOSTR_SWAP_TOPIC],
      ['s', 'open'],
      ['w', wantedAsset],
      ['p', nostrPubkey],
    ];

    const eventTemplate = {
      kind: NOSTR_SWAP_INTENTION_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify(fullIntentionData),
    };

    try {
      const signedEvent = finalizeEvent({ ...eventTemplate, pubkey: nostrPubkey }, privKey);
      await Promise.any(pool.publish(RELAYS, signedEvent));
      return signedEvent.id;
    } catch (err) {
      console.error('Failed to publish swap intention:', err);
      throw new Error('Failed to publish swap intention. Please try again.');
    }
  }, [nostrPubkey, privKey, pool, generateDTag]);

  const postNewSwapIntention = publishSwapIntention;

  // Invoice publication is a separate event kind so either participant can publish it.
  const publishInvoiceForIntention = useCallback(async (intention, invoiceData, publisherStarknetAddress = '') => {
    if (!nostrPubkey || !privKey) throw new Error('Nostr identity not established or private key unavailable.');

    const posterPubkey = intention.posterPubkey || intention.pubkey;
    const dTag = intention.dTag;
    if (!posterPubkey || !dTag || !intention.id) throw new Error('Invalid intention payload.');
    if (!invoiceData?.paymentRequest || !invoiceData?.paymentHash) {
      throw new Error('Missing paymentRequest/paymentHash to publish invoice.');
    }

    const aRef = `${NOSTR_SWAP_INTENTION_KIND}:${posterPubkey}:${dTag}`;

    const content = {
      dTag,
      intentionId: intention.id,
      status: 'invoice_ready',
      posterPubkey,
      invoicePublisherPubkey: nostrPubkey,
      invoicePublisherStarknetAddress: publisherStarknetAddress,
      paymentRequest: invoiceData.paymentRequest,
      paymentHash: invoiceData.paymentHash,
      publishedAt: Math.floor(Date.now() / 1000),
    };

    const tags = [
      ['t', NOSTR_SWAP_TOPIC],
      ['s', 'invoice_ready'],
      ['w', normalizeWantedAsset(intention.wantedAsset)],
      ['a', aRef],
      ['e', intention.id],
      ['d', dTag],
      ['h', invoiceData.paymentHash],
      ['p', posterPubkey],
      ['p', nostrPubkey],
    ];

    const eventTemplate = {
      kind: NOSTR_SWAP_INVOICE_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify(content),
    };

    try {
      const signedEvent = finalizeEvent({ ...eventTemplate, pubkey: nostrPubkey }, privKey);
      await Promise.any(pool.publish(RELAYS, signedEvent));
      return signedEvent.id;
    } catch (err) {
      console.error('Failed to publish invoice update:', err);
      throw new Error('Failed to publish invoice update. Please try again.');
    }
  }, [nostrPubkey, privKey, pool]);

  const acceptSwapIntention = useCallback(async (intention, accepterStarknetAddress = '') => {
    if (!nostrPubkey || !privKey) throw new Error('Nostr identity not established or private key unavailable.');

    const posterPubkey = intention.posterPubkey || intention.pubkey;
    const dTag = intention.dTag;
    if (!posterPubkey || !dTag || !intention.id) {
      throw new Error('Invalid intention payload: missing poster pubkey, dTag, or id.');
    }

    const acceptContent = {
      dTag,
      intentionId: intention.id,
      status: 'accepted',
      posterPubkey,
      accepterPubkey: nostrPubkey,
      accepterStarknetAddress,
      acceptedAt: Math.floor(Date.now() / 1000),
    };

    const aRef = `${NOSTR_SWAP_INTENTION_KIND}:${posterPubkey}:${dTag}`;
    const tags = [
      ['t', NOSTR_SWAP_TOPIC],
      ['s', 'accepted'],
      ['w', normalizeWantedAsset(intention.wantedAsset)],
      ['a', aRef],
      ['e', intention.id],
      ['d', dTag],
      ['p', posterPubkey],
      ['p', nostrPubkey],
    ];

    const eventTemplate = {
      kind: NOSTR_SWAP_ACCEPT_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify(acceptContent),
    };

    try {
      const signedEvent = finalizeEvent({ ...eventTemplate, pubkey: nostrPubkey }, privKey);
      await Promise.any(pool.publish(RELAYS, signedEvent));
      return signedEvent.id;
    } catch (err) {
      console.error('Failed to publish swap acceptance:', err);
      throw new Error('Failed to accept swap intention. Please try again.');
    }
  }, [nostrPubkey, privKey, pool]);

  const publishClaimForIntention = useCallback(async (intention, claimData = {}, claimerStarknetAddress = '') => {
    if (!nostrPubkey || !privKey) throw new Error('Nostr identity not established or private key unavailable.');

    const posterPubkey = intention.posterPubkey || intention.pubkey;
    const dTag = intention.dTag;
    if (!posterPubkey || !dTag || !intention.id) throw new Error('Invalid intention payload.');

    const aRef = `${NOSTR_SWAP_INTENTION_KIND}:${posterPubkey}:${dTag}`;
    const content = {
      dTag,
      intentionId: intention.id,
      status: 'claimed',
      posterPubkey,
      claimerPubkey: nostrPubkey,
      claimerStarknetAddress,
      claimTxHash: claimData.claimTxHash || '',
      paymentHash: claimData.paymentHash || '',
      claimedAt: Math.floor(Date.now() / 1000),
    };

    const tags = [
      ['t', NOSTR_SWAP_TOPIC],
      ['s', 'claimed'],
      ['w', normalizeWantedAsset(intention.wantedAsset)],
      ['a', aRef],
      ['e', intention.id],
      ['d', dTag],
      ['p', posterPubkey],
      ['p', nostrPubkey],
    ];

    const eventTemplate = {
      kind: NOSTR_SWAP_CLAIM_KIND,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify(content),
    };

    try {
      const signedEvent = finalizeEvent({ ...eventTemplate, pubkey: nostrPubkey }, privKey);
      await Promise.any(pool.publish(RELAYS, signedEvent));
      return signedEvent.id;
    } catch (err) {
      console.error('Failed to publish claim update:', err);
      throw new Error('Failed to publish claim update. Please try again.');
    }
  }, [nostrPubkey, privKey, pool]);

  const fetchSwapIntentions = useCallback(async () => {
    const intentionsMap = new Map();
    const acceptMap = new Map();
    const invoiceMap = new Map();
    const claimMap = new Map();

    try {
      // Query all related kinds in one go for better relay consistency
      const allEvents = await pool.querySync(RELAYS, {
        kinds: [NOSTR_SWAP_INTENTION_KIND, NOSTR_SWAP_ACCEPT_KIND, NOSTR_SWAP_INVOICE_KIND, NOSTR_SWAP_CLAIM_KIND],
        '#t': [NOSTR_SWAP_TOPIC],
        limit: 500,
      });

      // Sort events by creation time to ensure we process latest updates correctly
      allEvents.sort((a, b) => a.created_at - b.created_at);

      const intentionEvents = allEvents.filter(e => e.kind === NOSTR_SWAP_INTENTION_KIND);
      const acceptEvents = allEvents.filter(e => e.kind === NOSTR_SWAP_ACCEPT_KIND);
      const invoiceEvents = allEvents.filter(e => e.kind === NOSTR_SWAP_INVOICE_KIND);
      const claimEvents = allEvents.filter(e => e.kind === NOSTR_SWAP_CLAIM_KIND);

      for (const event of intentionEvents) {
        try {
          const dTag = extractTagValue(event.tags, 'd');
          if (!dTag) continue;

          const contentData = JSON.parse(event.content || '{}');
          const current = intentionsMap.get(dTag);

          if (!current || event.created_at >= current.created_at) {
            intentionsMap.set(dTag, {
              dTag,
              id: event.id,
              created_at: event.created_at,
              pubkey: event.pubkey,
              posterPubkey: contentData.posterPubkey || event.pubkey,
              status: contentData.status || extractTagValue(event.tags, 's') || 'open',
              wantedAsset: normalizeWantedAsset(contentData.wantedAsset || extractTagValue(event.tags, 'w')),
              amountSTRK: contentData.amountSTRK || '',
              amountSats: contentData.amountSats || '',
              paymentRequest: contentData.paymentRequest || '',
              paymentHash: contentData.paymentHash || '',
              posterStarknetAddress: contentData.posterStarknetAddress || '',
              contractAddress: contentData.contractAddress || '',
              timelock: contentData.timelock || null,
            });
          }
        } catch (e) {
          console.error(`Error parsing swap intention event ${event.id}:`, e);
        }
      }

      for (const event of acceptEvents) {
        try {
          const contentData = JSON.parse(event.content || '{}');
          const dFromTag = extractTagValue(event.tags, 'd');
          const dFromA = extractDTagFromARef(extractTagValue(event.tags, 'a'));
          const dTag = contentData.dTag || dFromTag || dFromA;
          if (!dTag) continue;

          const current = acceptMap.get(dTag);
          if (!current || event.created_at >= current.created_at) {
            acceptMap.set(dTag, {
              id: event.id,
              created_at: event.created_at,
              accepterPubkey: contentData.accepterPubkey || event.pubkey,
              accepterStarknetAddress: contentData.accepterStarknetAddress || '',
            });
          }
        } catch (e) {
          console.error(`Error parsing swap accept event ${event.id}:`, e);
        }
      }

      for (const event of invoiceEvents) {
        try {
          const contentData = JSON.parse(event.content || '{}');
          const dFromTag = extractTagValue(event.tags, 'd');
          const dFromA = extractDTagFromARef(extractTagValue(event.tags, 'a'));
          const dTag = contentData.dTag || dFromTag || dFromA;
          if (!dTag) continue;

          const current = invoiceMap.get(dTag);
          if (!current || event.created_at >= current.created_at) {
            invoiceMap.set(dTag, {
              id: event.id,
              created_at: event.created_at,
              paymentRequest: contentData.paymentRequest || '',
              paymentHash: contentData.paymentHash || extractTagValue(event.tags, 'h') || '',
              invoicePublisherPubkey: contentData.invoicePublisherPubkey || event.pubkey,
              invoicePublisherStarknetAddress: contentData.invoicePublisherStarknetAddress || '',
            });
          }
        } catch (e) {
          console.error(`Error parsing swap invoice event ${event.id}:`, e);
        }
      }

      for (const event of claimEvents) {
        try {
          const contentData = JSON.parse(event.content || '{}');
          const dFromTag = extractTagValue(event.tags, 'd');
          const dFromA = extractDTagFromARef(extractTagValue(event.tags, 'a'));
          const dTag = contentData.dTag || dFromTag || dFromA;
          if (!dTag) continue;

          const current = claimMap.get(dTag);
          if (!current || event.created_at >= current.created_at) {
            claimMap.set(dTag, {
              id: event.id,
              created_at: event.created_at,
              claimerPubkey: contentData.claimerPubkey || event.pubkey,
              claimerStarknetAddress: contentData.claimerStarknetAddress || '',
              claimTxHash: contentData.claimTxHash || '',
              paymentHash: contentData.paymentHash || '',
            });
          }
        } catch (e) {
          console.error(`Error parsing swap claim event ${event.id}:`, e);
        }
      }

      const intentions = Array.from(intentionsMap.values()).map((item) => {
        const accepted = acceptMap.get(item.dTag);
        const invoice = invoiceMap.get(item.dTag);
        const claimed = claimMap.get(item.dTag);

        const merged = { ...item };

        if (accepted) {
          merged.status = merged.status === 'open' ? 'accepted' : merged.status;
          merged.acceptedByPubkey = accepted.accepterPubkey;
          merged.accepterStarknetAddress = accepted.accepterStarknetAddress;
          merged.acceptedAt = accepted.created_at;
        }

        if (invoice) {
          merged.status = 'invoice_ready';
          merged.paymentRequest = invoice.paymentRequest;
          merged.paymentHash = invoice.paymentHash;
          merged.invoicePublisherPubkey = invoice.invoicePublisherPubkey;
          merged.invoicePublisherStarknetAddress = invoice.invoicePublisherStarknetAddress;
          merged.invoicePublishedAt = invoice.created_at;
        }

        if (claimed) {
          merged.status = 'claimed';
          merged.claimerPubkey = claimed.claimerPubkey;
          merged.claimerStarknetAddress = claimed.claimerStarknetAddress;
          merged.claimTxHash = claimed.claimTxHash;
          merged.claimedAt = claimed.created_at;
        }

        return merged;
      });

      intentions.sort((a, b) => b.created_at - a.created_at);
      return intentions;
    } catch (error) {
      console.error('Error fetching swap intentions:', error);
      return [];
    }
  }, [pool]);

  useEffect(() => () => {
    pool.close(RELAYS);
  }, [pool]);

  return (
    <NostrContext.Provider
      value={{
        nostrPubkey,
        publishSwapIntention,
        postNewSwapIntention,
        publishInvoiceForIntention,
        publishClaimForIntention,
        acceptSwapIntention,
        fetchSwapIntentions,
        deriveNostrKeysFromLNC,
        isLoadingNostr,
        disconnectNostr,
        nostrPrivkey: privKey,
        pool,
      }}
    >
      {children}
    </NostrContext.Provider>
  );
};

export const useNostr = () => {
  const context = useContext(NostrContext);
  if (!context) throw new Error('useNostr must be used within NostrProvider');
  return context;
};
