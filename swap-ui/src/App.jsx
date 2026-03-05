import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useProvider } from '@starknet-react/core';
import { sepolia } from '@starknet-react/chains';
import { Contract, CallData, RpcProvider, uint256 } from 'starknet';
import { useLNC } from './hooks/useLNC';
import { useTaprootAssets } from './hooks/useTaprootAssets';
import { Buffer } from 'buffer';

import AtomicSwapArtifact from '../target/dev/tap_swap_starknet_AtomicSwap.contract_class.json'; // Ensure this points to the generated ABI in starknet contracts once deployed
import ConnectScreen from './components/ConnectScreen';

import { NostrProvider, useNostr, NOSTR_SWAP_INVOICE_KIND, NOSTR_SWAP_INTENTION_KIND } from './contexts/NostrContext';
import NostrIdentityDisplay from './components/NostrIdentityDisplay';
import NodeInfo from './components/NodeInfo';
import TaprootAssetSelector from './components/TaprootAssetSelector';
import CreateSwapIntention from './components/CreateSwapIntention';
import SwapIntentionsList from './components/SwapIntentionsList';
import ClaimableIntentionsList from './components/ClaimableIntentionsList';
import Header from './components/Header';
import Modal from './components/Modal';
import { decode } from 'light-bolt11-decoder';
import InvoiceDecoder from './components/InvoiceDecoder';

const base64ToHex = (base64) => `0x${Buffer.from(base64, 'base64').toString('hex')}`;

const SWAP_AMOUNT_TAP_SATOSHIS = 500;
// Represents 0.00005 STRK. (STRK has 18 decimals)
const SWAP_AMOUNT_STRK = 50000000000000n; // 0.00005 * 10^18
const STRK_TIMELOCK_OFFSET = 3600;

// Replace with deployed Starknet contract address
const ATOMIC_SWAP_STARKNET_CONTRACT_ADDRESS = '0x0452bbb53015c30fee95d0c4620da0f3acb04129ebad2b2c8a2dd2b382fe4d1f';
const STRK_TOKEN_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d';
const STARKNET_SEPOLIA_RPC_URLS = [
  'https://api.zan.top/public/starknet-sepolia/rpc/v0_10',
  'https://free-rpc.nethermind.io/sepolia-juno/',
];
const STARKNET_SEPOLIA_RPC_URL = STARKNET_SEPOLIA_RPC_URLS[0];

console.log('--- DEBUG INFO FOR ABI IMPORT ---');
console.log('Keys in AtomicSwapArtifact:', Object.keys(AtomicSwapArtifact || {}));
console.log('Type of abi:', typeof (AtomicSwapArtifact?.abi));
console.log('--- END DEBUG INFO ---');

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.snort.social',
];

const extractTagValue = (tags, key) => tags.find((tag) => tag[0] === key)?.[1];

const normalizeHashlockToHex = (hashValue) => {
  if (!hashValue || typeof hashValue !== 'string') {
    throw new Error('Missing payment hash/hashlock.');
  }

  const trimmed = hashValue.trim();
  const raw = trimmed.startsWith('0x') ? trimmed.slice(2) : trimmed;

  let normalizedHex = raw;
  if (raw.length === 44) {
    normalizedHex = Buffer.from(raw, 'base64').toString('hex');
  } else if (raw.length === 88) {
    const ascii = Buffer.from(raw, 'hex').toString('utf8');
    normalizedHex = Buffer.from(ascii, 'base64').toString('hex');
  }

  if (!/^[0-9a-fA-F]+$/.test(normalizedHex)) {
    throw new Error('Payment hash format is invalid.');
  }
  if (normalizedHex.length !== 64) {
    throw new Error('Payment hash must be 32 bytes (64 hex chars).');
  }

  return `0x${normalizedHex.toLowerCase()}`;
};

const normalizeStarknetTxHash = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return value.transaction_hash || value.transactionHash || value.tx_hash || value.txHash || value.hash || '';
  }
  return '';
};



// Taproot Assets Configuration
const DEMO_MODE = true; // Set to false in production
const PRODUCTION_ASSET_NAME = 'TAPROOT_STRK'; // The asset to use in production
const FORCED_TAPROOT_ASSET_ID = 'f90c557d6c0cc9ff3acfc96212eb7f79c312c54dc5ccfb27835a67ee7f590da4';

function AppContent() {
  const { address, account, isConnected, connector, chainId } = useAccount();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();
  // Using starknet-react hook for direct provider interaction
  const { provider: publicClient } = useProvider();

  const starknetReadProvider = useMemo(
    () => new RpcProvider({ nodeUrl: STARKNET_SEPOLIA_RPC_URL }),
    []
  );

  const {
    lnc: lncClient,
    status: lncStatus,
    connectWithPairing,
    loginWithPassword,
    disconnect: disconnectLNC,
    logout: logoutLNC,
    error: lncError,
    isReady: lncIsConnected,
    isPaired: lncIsPaired,
  } = useLNC();

  const [lncPairingPhrase, setLncPairingPhrase] = useState('');
  const [lncPassword, setLncPassword] = useState('');

  // Taproot Assets hook
  const {
    assets: taprootAssets,
    isLoading: isLoadingAssets,
    error: assetsError,
    selectedAsset,
    setSelectedAsset,
    fetchAssets,
    createAssetInvoice,
    isTapdAvailable,
    isTapdChannelsAvailable,
  } = useTaprootAssets(lncClient, lncIsConnected);

  const {
    nostrPubkey,
    publishSwapIntention,
    publishInvoiceForIntention,
    fetchSwapIntentions,
    deriveNostrKeysFromLNC,
    isLoadingNostr,
    nostrPrivkey,
    pool,
  } = useNostr();

  const [errorMessage, setErrorMessage] = useState('');

  const [invoicePaymentRequest, setInvoicePaymentRequest] = useState('');
  const [invoicePaymentHash, setInvoicePaymentHash] = useState(null);
  const [invoicePreimage, setInvoicePreimage] = useState(null);
  const [swapStatus, setSwapStatus] = useState('Idle');
  const [contractAddress] = useState(ATOMIC_SWAP_STARKNET_CONTRACT_ADDRESS);

  const [selectedSwapIntention, setSelectedSwapIntention] = useState(null);
  const [wantedAsset, setWantedAsset] = useState('STRK');
  const [allowSelfAccept, setAllowSelfAccept] = useState(true);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectionSuccess, setConnectionSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState('create');
  const [claimedSwapDTags, setClaimedSwapDTags] = useState([]);

  // Modal states
  const [isNostrModalOpen, setIsNostrModalOpen] = useState(false);
  const [isNodeModalOpen, setIsNodeModalOpen] = useState(false);

  // Locally generated invoice that is not yet published to Nostr.
  const [pendingInvoice, setPendingInvoice] = useState(null);

  // Manual invoice input
  const [manualInvoice, setManualInvoice] = useState('');

  // Claimer state (Counterparty)
  const [strkLockVerified, setStrkLockVerified] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState('');
  const [claimerPreimage, setClaimerPreimage] = useState('');
  const [isPayingInvoice, setIsPayingInvoice] = useState(false);
  const [isClaimingStrk, setIsClaimingStrk] = useState(false);
  const [invoiceMethod, setInvoiceMethod] = useState('manual');
  const [recoveryTxHash, setRecoveryTxHash] = useState('');
  const [walletError, setWalletError] = useState('');
  const [isConnectingWallet, setIsConnectingWallet] = useState(false);
  const isWalletConnected = Boolean(isConnected && address);
  const walletNetwork = !isWalletConnected
    ? ''
    : (chainId === sepolia.id ? 'sepolia' : `chain-${chainId?.toString(16) || 'unknown'}`);
  const walletType = connector?.name || connector?.id || '';

  useEffect(() => {
    if (isWalletConnected) {
      setConnectionSuccess(true);
      const timer = setTimeout(() => setConnectionSuccess(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isWalletConnected]);

  const activeStarknetAddress = address || '';

  const assertContractDeployedOnSepolia = useCallback(async (addressToCheck, label) => {
    if (!addressToCheck) {
      throw new Error(`${label} address is missing.`);
    }

    let lastError = null;

    for (const rpcUrl of STARKNET_SEPOLIA_RPC_URLS) {
      const provider = new RpcProvider({ nodeUrl: rpcUrl });
      try {
        await provider.getClassAt(addressToCheck);
        return;
      } catch (err) {
        lastError = err;
        const rawMessage = err?.message || String(err);
        const notFound = /contract not found/i.test(rawMessage);
        const fetchFailed = /failed to fetch|networkerror|load failed/i.test(rawMessage);

        if (notFound) {
          if (label === 'Wallet account') {
            throw new Error(
              `${label} ${addressToCheck} is not deployed on Starknet Sepolia. Switch to Starknet Sepolia, deploy/fund the account, and reconnect.`
            );
          }
          throw new Error(
            `${label} ${addressToCheck} was not found on Starknet Sepolia. Check your deployment address and network.`
          );
        }

        if (!fetchFailed) {
          throw new Error(`Failed to verify ${label} on Starknet Sepolia: ${rawMessage}`);
        }
      }
    }

    const finalMessage = lastError?.message || String(lastError || 'unknown error');
    throw new Error(`Failed to verify ${label} on Starknet Sepolia: ${finalMessage}`);
  }, []);

  const isDeterministicDeploymentError = useCallback((err) => {
    const message = (err?.message || String(err || '')).toLowerCase();
    return message.includes('contract not found')
      || message.includes('is not deployed on starknet sepolia')
      || message.includes('was not found on starknet sepolia');
  }, []);

  // Set default method to LNC if it becomes available
  useEffect(() => {
    if (lncIsConnected) {
      setInvoiceMethod('lnc');
    } else {
      setInvoiceMethod('manual');
    }
  }, [lncIsConnected]);

  // Auto-close connect modal when both are connected
  useEffect(() => {
    if (lncIsConnected && isWalletConnected) {
      setIsConnectModalOpen(false);
    }
  }, [lncIsConnected, isWalletConnected]);

  const handleConnectWallet = useCallback(async (specificConnector) => {
    setWalletError('');
    setIsConnectingWallet(true);
    setErrorMessage('');

    try {
      let selectedConnector = specificConnector || null;

      if (!selectedConnector) {
        // Auto-pick: prefer braavos, then any other available connector
        const priorityOrder = ['braavos', 'argent'];
        for (const connectorId of priorityOrder) {
          const candidate = connectors.find((item) => (item?.id || '').toLowerCase().includes(connectorId));
          if (candidate) {
            selectedConnector = candidate;
            break;
          }
        }
        if (!selectedConnector && connectors.length > 0) {
          selectedConnector = connectors[0];
        }
      }

      if (!selectedConnector) {
        throw new Error('No Starknet wallet connector found. Install Braavos or ArgentX.');
      }

      await connectAsync({ connector: selectedConnector });
    } catch (err) {
      const message = err?.message || err?.error?.message || 'Failed to connect Starknet wallet.';

      // Braavos does not implement wallet_switchStarknetChain but the connection
      // itself succeeds. Swallow this specific error so the user is not confused.
      const isChainSwitchError =
        message.toLowerCase().includes('wallet_switchstarknetchain') ||
        message.toLowerCase().includes('unsupported dapp request');
      if (isChainSwitchError) {
        console.info('Braavos does not support wallet_switchStarknetChain — ignoring, connection succeeded.');
        return; // connection is fine, no need to show an error
      }
      setWalletError(message);
      setErrorMessage(message);
    } finally {
      setIsConnectingWallet(false);
    }
  }, [connectAsync, connectors]);

  const handleDisconnectWallet = useCallback(async () => {
    setWalletError('');
    setConnectionSuccess(false);

    if (isConnected) {
      try {
        await disconnectAsync();
      } catch (err) {
        console.warn('starknet-react disconnect failed:', err);
      }
    }
  }, [disconnectAsync, isConnected]);

  const selectedPosterPubkey = selectedSwapIntention ? (selectedSwapIntention.posterPubkey || selectedSwapIntention.pubkey) : '';
  const isSelectedPoster = Boolean(selectedSwapIntention && selectedPosterPubkey === nostrPubkey);
  const isSelectedAccepter = Boolean(selectedSwapIntention && selectedSwapIntention.acceptedByPubkey === nostrPubkey);
  const isSelectedAccepted = Boolean(selectedSwapIntention && ['accepted', 'invoice_ready'].includes(selectedSwapIntention.status));
  const selectedWantedAsset = selectedSwapIntention?.wantedAsset || null;

  const invoicePublisherRole = selectedWantedAsset === 'STRK' ? 'accepter' : 'poster';
  const lockerRole = selectedWantedAsset === 'STRK' ? 'accepter' : 'poster';

  const isPublisherRoleMatch =
    Boolean(selectedSwapIntention) &&
    ((invoicePublisherRole === 'poster' && isSelectedPoster) ||
      (invoicePublisherRole === 'accepter' && isSelectedAccepter));

  const isLockerRoleMatch =
    Boolean(selectedSwapIntention) &&
    ((lockerRole === 'poster' && isSelectedPoster) ||
      (lockerRole === 'accepter' && isSelectedAccepter));

  const claimerRole = selectedWantedAsset === 'STRK' ? 'poster' : 'accepter';
  const isClaimerRoleMatch =
    Boolean(selectedSwapIntention) &&
    ((claimerRole === 'poster' && isSelectedPoster) ||
      (claimerRole === 'accepter' && isSelectedAccepter));

  const pendingInvoiceForSelected = Boolean(
    pendingInvoice && selectedSwapIntention && pendingInvoice.dTag === selectedSwapIntention.dTag,
  );

  const sanitizedManualInvoice = useMemo(() => {
    if (!manualInvoice) return '';
    return manualInvoice.trim().replace(/\s+/g, '');
  }, [manualInvoice]);

  const manualInvoiceHash = useMemo(() => {
    if (!sanitizedManualInvoice) return null;
    try {
      const decoded = decode(sanitizedManualInvoice.toLowerCase());
      const paymentHashSection = decoded.sections.find(s => s.name === 'payment_hash');
      const val = paymentHashSection?.value;
      return val ? (val.startsWith('0x') ? val : `0x${val}`) : null;
    } catch (e) {
      return null;
    }
  }, [sanitizedManualInvoice]);

  const effectiveInvoicePaymentHash = useMemo(() => {
    // Priority:
    // 1. Manual input from user
    // 2. Data already indexed on Nostr (if present in the selected intention)
    // 3. Local session memory (invoicePaymentHash)
    // 4. Pending local state (not yet published)
    return manualInvoiceHash ||
      selectedSwapIntention?.paymentHash ||
      invoicePaymentHash ||
      (pendingInvoiceForSelected ? pendingInvoice?.paymentHash : null);
  }, [manualInvoiceHash, selectedSwapIntention, invoicePaymentHash, pendingInvoiceForSelected, pendingInvoice]);

  const effectiveInvoicePaymentRequest = useMemo(() => {
    return sanitizedManualInvoice ||
      selectedSwapIntention?.paymentRequest ||
      invoicePaymentRequest ||
      (pendingInvoiceForSelected ? pendingInvoice?.paymentRequest : '');
  }, [sanitizedManualInvoice, selectedSwapIntention, invoicePaymentRequest, pendingInvoiceForSelected, pendingInvoice]);

  const canGenerateInvoice = Boolean(selectedSwapIntention) && isSelectedAccepted && isPublisherRoleMatch;
  const canLockStrk = Boolean(selectedSwapIntention) && isSelectedAccepted && isLockerRoleMatch && Boolean(effectiveInvoicePaymentHash);

  const generateInvoiceDisabledReason = !selectedSwapIntention
    ? 'Select an intention first.'
    : !isSelectedAccepted
      ? 'This intention must be accepted first. Use Accept in Market.'
      : !isPublisherRoleMatch
        ? (selectedWantedAsset === 'STRK'
          ? 'For wants STRK, only accepter can generate invoice.'
          : 'For wants Taproot STRK, only poster can generate invoice.')
        : '';

  const lockStrkDisabledReason = !selectedSwapIntention
    ? 'Select an intention first.'
    : !isWalletConnected || !activeStarknetAddress
      ? 'Connect your Starknet wallet first.'
      : !isSelectedAccepted
        ? 'This intention must be accepted first.'
        : !effectiveInvoicePaymentHash
          ? 'Generate invoice first. It will be published only after lock.'
          : !isLockerRoleMatch
            ? (selectedWantedAsset === 'STRK'
              ? 'For wants STRK, only accepter locks STRK.'
              : 'For wants Taproot STRK, only poster locks STRK.')
            : '';

  // Auto move between tabs removed to prevent conflicts with Claim tab.
  // Tab switching is now handled explicitly in onSelect handlers.

  const tabClass = (key) => `flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300 text-center flex items-center justify-center gap-2 ${activeTab === key
    ? 'bg-white text-indigo-700 shadow-md transform scale-[1.02]'
    : 'text-slate-600 hover:bg-white/50 hover:text-indigo-600'
    }`;

  // ...



  const handleLncPairingPhraseChange = (e) => setLncPairingPhrase(e.target.value);
  const handleLncPasswordChange = (e) => setLncPassword(e.target.value);

  const handleConnectLNCWithPairing = async (pairingPhrase, password) => {
    setErrorMessage('');
    try {
      await connectWithPairing(pairingPhrase, password);
      setLncPairingPhrase('');
      setLncPassword('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to connect to LNC node.');
    }
  };

  const handleLoginLNCWithPassword = async (password) => {
    setErrorMessage('');
    try {
      await loginWithPassword(password);
      setLncPassword('');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to login to LNC node.');
    }
  };

  const handleDisconnectLNC = useCallback(() => {
    disconnectLNC();
    setLncPassword('');
    setErrorMessage('');
  }, [disconnectLNC]);

  const handleLogoutLNC = useCallback(() => {
    logoutLNC();
    setLncPairingPhrase('');
    setLncPassword('');
    setErrorMessage('');
  }, [logoutLNC]);

  const sendStarknetCalls = useCallback(async (calls) => {
    if (!account || !isWalletConnected) {
      throw new Error('No Starknet wallet account connected.');
    }

    if (chainId && chainId !== sepolia.id) {
      throw new Error('Wallet is on the wrong network. Switch wallet to Starknet Sepolia and retry.');
    }

    const invokeCalls = calls.map((call) => ({
      contractAddress: call.contractAddress,
      entrypoint: call.entrypoint,
      calldata: call.calldata,
    }));

    const response = await account.execute(invokeCalls);
    const txHash = normalizeStarknetTxHash(response);
    if (!txHash) {
      throw new Error('Wallet returned success but no transaction hash.');
    }
    return txHash;
  }, [account, chainId, isWalletConnected]);

  const lncSignMessageForNostr = useCallback(async (message) => {
    if (!lncClient?.lnd?.lightning) {
      throw new Error('LNC client not ready to sign message.');
    }
    const messageBytes = new TextEncoder().encode(message);
    const messageBase64 = Buffer.from(messageBytes).toString('base64');
    const signResponse = await lncClient.lnd.lightning.signMessage({ msg: messageBase64 });
    return base64ToHex(signResponse.signature);
  }, [lncClient]);

  const isLncApiReady = useCallback(() => lncIsConnected, [lncIsConnected]);

  useEffect(() => {
    if (isLncApiReady() && !nostrPubkey && !isLoadingNostr) {
      deriveNostrKeysFromLNC(lncSignMessageForNostr);
    }
  }, [isLncApiReady, nostrPubkey, isLoadingNostr, deriveNostrKeysFromLNC, lncSignMessageForNostr]);

  const verifySTRKLock = async () => {
    if (!selectedSwapIntention) {
      setErrorMessage('Select an intention first.');
      return;
    }

    setStrkLockVerified(false);
    setErrorMessage('');

    let hashToVerify = effectiveInvoicePaymentHash;
    let updatedIntention = null;

    // Fetch from Nostr FIRST
    setSwapStatus('Fetching invoice from Nostr...');
    try {
      const targetedEvents = await pool.querySync(RELAYS, {
        kinds: [NOSTR_SWAP_INVOICE_KIND],
        '#e': [selectedSwapIntention.id],
        limit: 10,
      });

      if (targetedEvents.length > 0) {
        targetedEvents.sort((a, b) => b.created_at - a.created_at);
        const latestInvoice = targetedEvents[0];
        try {
          const content = JSON.parse(latestInvoice.content || '{}');
          updatedIntention = {
            ...selectedSwapIntention,
            status: 'invoice_ready',
            paymentRequest: content.paymentRequest || '',
            paymentHash: content.paymentHash || extractTagValue(latestInvoice.tags, 'h') || '',
          };
          if (updatedIntention.paymentHash) {
            hashToVerify = updatedIntention.paymentHash;
            setInvoicePaymentRequest(updatedIntention.paymentRequest);
            setInvoicePaymentHash(updatedIntention.paymentHash);
            setSelectedSwapIntention(updatedIntention);
            setStrkLockVerified(true);
          }

        } catch (e) {
          console.error('Error parsing targeted invoice event:', e);
        }
      }
    } catch (nostrErr) {
      console.warn('Nostr targeted sync failed:', nostrErr);
    }

    // Emergency Recovery: If hash is missing, attempt to pull it from a provided Transaction Hash
    if (!hashToVerify && recoveryTxHash) {
      setSwapStatus('Recovering payment hash from Transaction...');
      try {
        const receipt = await publicClient.getTransactionReceipt(recoveryTxHash);
        const swapInitiatedTopic = '0x3c6d334ba216fe7a5d16a0ad07a6b134fc9404d2317b59755e9e38b825a3bdbf'; // SwapInitiated
        const log = receipt.logs.find(l => l.topics[0] === swapInitiatedTopic);

        if (log) {
          hashToVerify = log.topics[1];
          setInvoicePaymentHash(hashToVerify);
          setSwapStatus('Payment hash recovered from blockchain! Verifying lock status...');
        } else {
          setErrorMessage('No swap initiation event found in this transaction.');
          return;
        }
      } catch (err) {
        setErrorMessage(`Recovery failed: ${err.message}`);
        return;
      }
    }

    if (!hashToVerify) {
      setErrorMessage('No payment hash found. Please wait for the counterparty to publish the invoice to Nostr.');
      return;
    }

    setSwapStatus('Verifying STRK Lock on Starknet...');

    try {
      let hash = hashToVerify;
      // Handle Base64 hash (44 chars) which might come from Nostr/LNC
      // 32 bytes = 44 chars in Base64, 64 chars in Hex.
      const raw = hash.startsWith('0x') ? hash.slice(2) : hash;

      if (raw.length === 44) {
        hash = `0x${Buffer.from(raw, 'base64').toString('hex')}`;
      } else if (raw.length === 88) {
        // Handle Hex-encoded ASCII of Base64 (Double encoded)
        const ascii = Buffer.from(raw, 'hex').toString('utf8');
        hash = `0x${Buffer.from(ascii, 'base64').toString('hex')}`;
      } else if (!hash.startsWith('0x')) {
        hash = `0x${hash}`;
      }

      let provider;
      console.log(AtomicSwapArtifact.abi)
      console.log(contractAddress)
      console.log(account)
      console.log(starknetReadProvider)
      console.log(Contract)
      if (account) {
        provider = new Contract({ abi: AtomicSwapArtifact.abi, address: contractAddress, provider: account });
      } else {
        provider = new Contract({ abi: AtomicSwapArtifact.abi, address: contractAddress, provider: starknetReadProvider });
      }

      // get_swap returns the Swap struct natively parsed
      const swapData = await provider.get_swap(hash);

      // Swap struct: value, sender, hashlock, timelock, claimed, refunded
      // value is a u256 struct { low, high } — convert to BigInt before comparing
      const amountBN = uint256.uint256ToBN(swapData.value);
      const isClaimed = swapData.claimed;
      const isRefunded = swapData.refunded;

      if (amountBN > 0n && !isClaimed && !isRefunded) {
        setStrkLockVerified(true);
        if (updatedIntention?.paymentRequest || invoicePaymentRequest) {
          setSwapStatus('Lock Verified on-chain and Invoice is ready! You can now pay.');
        } else {
          setSwapStatus('Lock Verified on-chain, but invoice request missing on Nostr. Try Manual Import.');
        }
        startInvoicePolling();
      } else {
        if (amountBN === 0n) setErrorMessage('STRK not locked yet (amount is 0).');
        else if (isClaimed) setErrorMessage('STRK already claimed.');
        else if (isRefunded) setErrorMessage('STRK already refunded.');
        setSwapStatus('STRK Lock Verification Failed.');
      }

    } catch (err) {
      console.error('Error verifying STRK lock:', err);
      setErrorMessage(err.message || 'Failed to verify STRK lock.');
      setSwapStatus('Verification Error');
    }
  };

  const handlePayInvoice = async () => {
    if (!effectiveInvoicePaymentRequest) return;
    if (!isLncApiReady()) {
      setErrorMessage('LNC not ready. Please pay manually and enter preimage.');
      return;
    }

    setIsPayingInvoice(true);
    setErrorMessage('');
    setSwapStatus('Paying invoice via LNC...');

    try {
      const response = await lncClient.lnd.lightning.sendPaymentSync({
        paymentRequest: effectiveInvoicePaymentRequest,
        // In test mode we allow paying our own invoice for end-to-end testing.
        allowSelfPayment: allowSelfAccept,
      });

      if (response.paymentError) {
        throw new Error(response.paymentError);
      }

      let preimageHex = '';
      if (typeof response.paymentPreimage === 'string') {
        const preimageStr = response.paymentPreimage;
        // Check if base64 or hex. Base64 32 bytes = 44 chars. Hex = 64 chars.
        if (preimageStr.length === 64 && /^[0-9a-fA-F]+$/.test(preimageStr)) {
          preimageHex = preimageStr;
        } else {
          preimageHex = Buffer.from(preimageStr, 'base64').toString('hex');
        }
      } else if (response.paymentPreimage) {
        preimageHex = Buffer.from(response.paymentPreimage).toString('hex');
      }

      if (!preimageHex) {
        throw new Error('No preimage received in payment response.');
      }

      setClaimerPreimage(preimageHex);
      setSwapStatus('Invoice paid! Preimage received. You can now claim STRK.');
    } catch (err) {
      console.error('LNC Payment failed:', err);
      setErrorMessage(`LNC Payment failed: ${err.message || String(err)}`);
      setSwapStatus('Payment Failed');
    } finally {
      setIsPayingInvoice(false);
    }
  };

  const handleClaimSTRK = async () => {
    if (!claimerPreimage) {
      setErrorMessage('Preimage required to claim STRK.');
      return;
    }
    setIsClaimingStrk(true);
    setErrorMessage('');
    setSwapStatus('Claiming STRK on Starknet...');

    try {
      // WORKAROUND for Starknet Cairo contract mock
      // The current `atomic_swap.cairo` has a placeholder for `compute_sha256_hash` 
      // that just returns the input `secret`. It does NOT actually hash it.
      // Therefore, to make the `claim_swap` pass its internal `hashlock == self.compute_sha256_hash(secret)` check,
      // we must pass the actual hashlock as the "secret". 
      // Once the Cairo contract implements real sha256, revert this to use the real `claimerPreimage`.
      const secretHex = effectiveInvoicePaymentHash || (claimerPreimage.startsWith('0x') ? claimerPreimage : `0x${claimerPreimage}`);

      const claimCalldata = CallData.compile([uint256.bnToUint256(secretHex)]);
      const hash = await sendStarknetCalls([
        {
          contractAddress: contractAddress,
          entrypoint: 'claim_swap',
          calldata: claimCalldata,
        },
      ]);

      setClaimTxHash(hash);
      // Since starknetReadProvider.waitForTransaction is sometimes stalling,
      // we'll use a polling loop with account/publicClient for verification.
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        try {
          console.log(i)
          console.log(hash)
          console.log(publicClient)
          const receipt = await publicClient.getTransactionReceipt(hash);
          console.log(receipt)
          if (receipt.execution_status === 'SUCCEEDED' || receipt.finality_status === 'ACCEPTED_ON_L2') {
            confirmed = true;
            break;
          }
        } catch (e) {
          console.log(e)
          // tx not found yet, wait and retry
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout or failed.');
      }

      setSwapStatus('STRK Claimed Successfully! Swap Completed.');
      setClaimedSwapDTags(prev => [...prev, selectedSwapIntention.dTag]);
    } catch (err) {
      console.error('Error claiming STRK:', err);
      setErrorMessage(`Failed to claim STRK: ${err.message || String(err)}`);
      setSwapStatus('Claim Error');
    } finally {
      setIsClaimingStrk(false);
    }
  };

  const createInvoice = async () => {
    if (!isLncApiReady()) {
      setErrorMessage('Lightning Node not connected or not ready via LNC.');
      return null;
    }
    if (!lncClient?.lnd?.lightning) {
      setErrorMessage('Lightning RPC service (LND) not available on LNC client.');
      return null;
    }

    // Check if Taproot Asset Channels is available
    const useTaprootAssets = isTapdChannelsAvailable && selectedAsset;

    if (useTaprootAssets) {
      // Try to create Taproot Asset invoice
      setSwapStatus('Generating Taproot Asset invoice...');
      setErrorMessage('');

      try {
        const invoice = await createAssetInvoice(
          selectedAsset,
          SWAP_AMOUNT_TAP_SATOSHIS,
          `Swap for ${SWAP_AMOUNT_STRK.toString()} STRK (Taproot Asset: ${selectedAsset.name})`
        );

        if (!invoice?.isAssetInvoice) {
          throw new Error('Generated invoice is not recognized as Taproot Asset invoice.');
        }
        return invoice;
      } catch (err) {
        console.error('Error creating Taproot Asset invoice:', err);
        setErrorMessage(`Failed to create Taproot Asset invoice: ${err.message || String(err)}`);
        setSwapStatus('Taproot Asset invoice failed');
        return null;
      }
    }

    // Fallback to regular Lightning invoice
    setSwapStatus('Generating Lightning invoice (BTC)...');
    setErrorMessage('');

    try {
      const invoiceAmountMsat = SWAP_AMOUNT_TAP_SATOSHIS * 1000;
      const addInvoiceResponse = await lncClient.lnd.lightning.addInvoice({
        valueMsat: invoiceAmountMsat.toString(),
        memo: `Swap for ${SWAP_AMOUNT_STRK.toString()} STRK (via LNC-web)${selectedAsset ? ` - Asset: ${selectedAsset.name}` : ''}`,
        private: true,
      });

      const paymentRequest = addInvoiceResponse.paymentRequest;

      let rHashBase64;
      if (typeof addInvoiceResponse.rHash === 'string') {
        rHashBase64 = addInvoiceResponse.rHash;
      } else {
        rHashBase64 = Buffer.from(addInvoiceResponse.rHash).toString('base64');
      }

      const paymentHash = base64ToHex(rHashBase64);

      return {
        paymentRequest,
        paymentHash,
        assetName: selectedAsset?.name || 'BTC',
        isFallback: !useTaprootAssets,
      };
    } catch (err) {
      console.error('Error creating Lightning invoice:', err);
      setErrorMessage(`Failed to create Lightning invoice: ${err.message || String(err)}`);
      setSwapStatus('Error');
      return null;
    }
  };

  const handleGenerateInvoice = async () => {
    if (!selectedSwapIntention) {
      setErrorMessage('Select an accepted intention first.');
      return;
    }
    if (!canGenerateInvoice) {
      setErrorMessage('You are not the invoice generator for this selected flow.');
      return;
    }

    // Manual invoice has top priority in effectiveInvoicePaymentRequest.
    // Clear it so LNC-generated invoices are immediately visible/usable.
    setManualInvoice('');

    const invoice = await createInvoice();
    if (!invoice) return;

    setPendingInvoice({ ...invoice, dTag: selectedSwapIntention.dTag });
    setInvoicePaymentRequest(invoice.paymentRequest);
    setInvoicePaymentHash(invoice.paymentHash);

    if (invoice.isFallback) {
      setSwapStatus(`Lightning invoice (BTC) generated. Using regular Lightning instead of Taproot Assets. Now lock STRK. Invoice will be published after lock.`);
    } else {
      setSwapStatus(`Taproot Asset invoice generated (${invoice.assetName}). Now lock STRK. Invoice will be published after lock.`);
    }

    setErrorMessage('');
    setActiveTab('execute');
  };

  const handlePublishSwapIntention = async () => {
    if (!nostrPubkey) {
      setErrorMessage('Nostr identity not established. Please ensure LNC is connected.');
      return;
    }
    if (!activeStarknetAddress) {
      setErrorMessage('Starknet wallet not connected.');
      return;
    }

    try {
      setSwapStatus('Publishing swap intention to Nostr...');
      const intentionId = await publishSwapIntention({
        amountSTRK: SWAP_AMOUNT_STRK.toString(),
        amountSats: SWAP_AMOUNT_TAP_SATOSHIS.toString(),
        wantedAsset,
        contractAddress,
      }, activeStarknetAddress);

      if (intentionId) {
        setSwapStatus('Intention published. Move to Market tab and wait for acceptance.');
        setErrorMessage('');
        setActiveTab('market');
      } else {
        setErrorMessage('Failed to publish swap intention to Nostr.');
      }
    } catch (err) {
      console.error('Error publishing swap intention:', err);
      setErrorMessage(`Failed to publish swap intention: ${err.message || String(err)}`);
    }
  };

  const initiateSTRKSwap = async () => {
    if (!isWalletConnected || !activeStarknetAddress || !effectiveInvoicePaymentHash) {
      setErrorMessage('Starknet wallet not connected, or invoice not available yet.');
      return;
    }

    if (!canLockStrk) {
      setErrorMessage('Based on the selected flow, you are not the STRK locker for this swap.');
      return;
    }

    if (selectedSwapIntention?.status === 'invoice_ready' || selectedSwapIntention?.status === 'locked') {
      setErrorMessage('STRK has already been locked for this intention and the invoice has been published. Cannot lock again.');
      return;
    }

    setSwapStatus('Locking STRK on Starknet...');
    setErrorMessage('');

    try {
      const prechecks = [
        [activeStarknetAddress, 'Wallet account'],
        [contractAddress, 'Atomic swap contract'],
        [STRK_TOKEN_ADDRESS, 'STRK token contract'],
      ];

      for (const [addressToCheck, label] of prechecks) {
        try {
          await assertContractDeployedOnSepolia(addressToCheck, label);
        } catch (verificationErr) {
          if (isDeterministicDeploymentError(verificationErr)) {
            throw verificationErr;
          }
          console.warn(`${label} deployment precheck skipped:`, verificationErr);
        }
      }

      const normalizedHashlock = normalizeHashlockToHex(effectiveInvoicePaymentHash);
      const strkTimelock = Math.floor(Date.now() / 1000) + STRK_TIMELOCK_OFFSET;
      const amountU256 = uint256.bnToUint256(SWAP_AMOUNT_STRK);
      const hashlockU256 = uint256.bnToUint256(normalizedHashlock);

      // Starknet requires multi-call: 1. Approve STRK, 2. Initiate Swap
      const txHash = await sendStarknetCalls([
        {
          contractAddress: STRK_TOKEN_ADDRESS,
          entrypoint: 'approve',
          calldata: CallData.compile([contractAddress, amountU256]),
        },
        {
          contractAddress: contractAddress,
          entrypoint: 'initiate_swap',
          calldata: CallData.compile([
            hashlockU256,
            strkTimelock,
            amountU256
          ]),
        },
      ]);

      setSwapStatus(`Lock transaction submitted (${txHash}). Waiting for confirmation...`);
      // Since starknetReadProvider.waitForTransaction is sometimes stalling,
      // we'll use a polling loop with account/publicClient for verification.
      let confirmed = false;
      for (let i = 0; i < 30; i++) {
        try {
          const receipt = await publicClient.getTransactionReceipt(txHash);
          if (receipt.execution_status === 'SUCCEEDED' || receipt.finality_status === 'ACCEPTED_ON_L2') {
            confirmed = true;
            break;
          }
        } catch (e) {
          // tx not found yet, wait and retry
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout or failed.');
      }
      setSwapStatus('Transaction confirmed! Verifying lock on-chain...');

      let swapContract;
      if (account) {
        swapContract = new Contract({ abi: AtomicSwapArtifact.abi, address: contractAddress, provider: account });
      } else {
        swapContract = new Contract({ abi: AtomicSwapArtifact.abi, address: contractAddress, provider: starknetReadProvider });
      }
      const swapData = await swapContract.get_swap(hashlockU256);
      // value is a u256 struct { low, high } — convert to BigInt before comparing
      const lockedAmount = swapData ? uint256.uint256ToBN(swapData.value) : 0n;
      if (!swapData || lockedAmount === 0n || swapData.refunded || swapData.claimed) {
        throw new Error('Swap lock verification failed after confirmation.');
      }

      setInvoicePaymentHash(normalizedHashlock);

      const invoiceToPublish = pendingInvoiceForSelected ? pendingInvoice :
        (manualInvoice && manualInvoiceHash === effectiveInvoicePaymentHash ? {
          paymentRequest: manualInvoice,
          paymentHash: normalizedHashlock
        } : null);

      if (invoiceToPublish && selectedSwapIntention) {
        setSwapStatus('STRK locked. Publishing invoice to Nostr...');
        await publishInvoiceForIntention(selectedSwapIntention, invoiceToPublish, activeStarknetAddress || '');

        setSelectedSwapIntention((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'invoice_ready',
            paymentRequest: invoiceToPublish.paymentRequest,
            paymentHash: invoiceToPublish.paymentHash,
          };
        });

        setSwapStatus('STRK locked and invoice published to Nostr. Counterparty can continue.');
        setPendingInvoice(null);
      } else {
        setSwapStatus('STRK locked on Starknet.');
      }

      setErrorMessage('');
      startInvoicePolling();
    } catch (err) {
      console.error('Error initiating STRK swap:', err);
      setErrorMessage(`Failed to initiate STRK swap: ${err.message || String(err)}`);
      setSwapStatus('Error');
    }
  };

  const startInvoicePolling = useCallback(() => {
    if (!isLncApiReady() || !effectiveInvoicePaymentHash) {
      setErrorMessage('Cannot poll: LNC not connected or payment hash missing.');
      return;
    }
    if (!lncClient?.lnd?.lightning) {
      setErrorMessage('Lightning RPC service (LND) not available for polling.');
      return;
    }

    setSwapStatus('Polling for LN invoice settlement...');
    const intervalId = setInterval(async () => {
      try {
        if (!lncClient || !isLncApiReady()) {
          clearInterval(intervalId);
          return;
        }

        // TODO: Convert hex to bytes for rHash
        // const rHashBytes = hexToBytes(effectiveInvoicePaymentHash);
        // const invoiceStatus = await lncClient.lnd.lightning.lookupInvoice({ rHash: rHashBytes });
        // For now, just simulate settlement or rely on manual preimage input

        // This part needs to be implemented correctly with hexToBytes and actual lookup
        // For demonstration, we'll assume it settles if we have a preimage
        if (invoicePreimage) { // Placeholder for actual settlement detection
          clearInterval(intervalId);
          setSwapStatus('LN invoice settled. Preimage obtained.');
          setErrorMessage('');
        }
      } catch (err) {
        console.error('Error polling invoice status:', err);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [lncClient, isLncApiReady, effectiveInvoicePaymentHash, invoicePreimage]);

  useEffect(() => {
    if (!isLncApiReady()) {
      setInvoicePaymentRequest('');
      setInvoicePaymentHash(null);
      setInvoicePreimage(null);
      setPendingInvoice(null);
      setSwapStatus('Idle');
      setActiveTab('create');
    }
  }, [isLncApiReady]);

  useEffect(() => {
    if (lncError) setErrorMessage(lncError);
  }, [lncError]);

  useEffect(() => {
    if (!selectedSwapIntention) {
      setInvoicePaymentRequest('');
      setInvoicePaymentHash(null);
      setPendingInvoice(null);
      setManualInvoice('');
      setInvoiceMethod(lncIsConnected ? 'lnc' : 'manual');
      return;
    }

    const pendingForSelected = pendingInvoice && pendingInvoice.dTag === selectedSwapIntention.dTag;
    if (pendingForSelected) {
      setInvoicePaymentRequest(pendingInvoice.paymentRequest);
      setInvoicePaymentHash(pendingInvoice.paymentHash);
      return;
    }

    setInvoicePaymentRequest(selectedSwapIntention.paymentRequest || '');
    setInvoicePaymentHash(selectedSwapIntention.paymentHash || null);

    if (pendingInvoice && pendingInvoice.dTag !== selectedSwapIntention.dTag) {
      setPendingInvoice(null);
    }
  }, [selectedSwapIntention, pendingInvoice]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Header */}
      <Header
        lncIsConnected={lncIsConnected}
        nostrConnected={!!nostrPubkey}
        walletConnected={isWalletConnected}
        walletAddress={activeStarknetAddress}
        onOpenNostrModal={() => setIsNostrModalOpen(true)}
        onOpenNodeModal={() => setIsNodeModalOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
      />

      {/* Modals */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Welcome to Atomic Swap"
      >
        <ConnectScreen
          pairingPhrase={lncPairingPhrase}
          setPairingPhrase={handleLncPairingPhraseChange}
          lncPassword={lncPassword}
          setLncPassword={handleLncPasswordChange}
          isConnectingLNC={lncStatus === 'Connecting'}
          handleConnectLNCWithPairing={handleConnectLNCWithPairing}
          handleLoginLNCWithPassword={handleLoginLNCWithPassword}
          handleDisconnectLNC={handleDisconnectLNC}
          handleLogoutLNC={handleLogoutLNC}
          connectionErrorLNC={lncError}
          isWalletConnected={isWalletConnected}
          walletAddress={activeStarknetAddress}
          walletNetwork={walletNetwork}
          walletType={walletType}
          isConnectingWallet={isConnectingWallet}
          onConnectWallet={handleConnectWallet}
          onDisconnectWallet={handleDisconnectWallet}
          connectionErrorWallet={walletError}
          lncIsPaired={lncIsPaired}
          lncIsConnected={lncIsConnected}
          onExploreAsGuest={() => setIsConnectModalOpen(false)}
          availableConnectors={connectors}
        />
      </Modal>

      <Modal
        isOpen={isNostrModalOpen}
        onClose={() => setIsNostrModalOpen(false)}
        title="Nostr Identity"
      >
        <NostrIdentityDisplay />
      </Modal>

      <Modal
        isOpen={isNodeModalOpen}
        onClose={() => setIsNodeModalOpen(false)}
        title="Lightning Node Info"
      >
        <NodeInfo
          lncClient={lncClient}
          isConnected={lncIsConnected}
        />
      </Modal>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center gap-6">
          {errorMessage && (
            <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl animate-bounce flex items-center gap-3 max-w-md">
              <span className="text-xl">⚠️</span>
              <p className="font-bold text-sm">{errorMessage}</p>
              <button onClick={() => setErrorMessage('')} className="ml-2 hover:text-red-200">✕</button>
            </div>
          )}

          {connectionSuccess && (
            <div className="fixed top-20 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-xl animate-fade-in-down flex items-center gap-3 border-2 border-green-400">
              <span className="text-xl">✅</span>
              <p className="font-bold text-sm">Wallet Connected Successfully!</p>
              <button onClick={() => setConnectionSuccess(false)} className="ml-2 hover:text-green-200">✕</button>
            </div>
          )}

          <div className="w-full max-w-2xl mb-8 mt-4">
            <div className="flex gap-2 p-1.5 bg-slate-200/50 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-inner">
              <button className={tabClass('create')} onClick={() => setActiveTab('create')}>
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                Create
              </button>
              <button className={tabClass('market')} onClick={() => setActiveTab('market')}>
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                Market
              </button>
              <button className={tabClass('execute')} onClick={() => setActiveTab('execute')}>
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                Lock
              </button>
              <button className={tabClass('claim')} onClick={() => setActiveTab('claim')}>
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                Claim
              </button>
            </div>
          </div>

          {activeTab === 'create' && (
            <>
              <CreateSwapIntention
                handlePublishSwapIntention={handlePublishSwapIntention}
                nostrPubkey={nostrPubkey}
                swapStatus={swapStatus}
                SWAP_AMOUNT_TAP_SATOSHIS={SWAP_AMOUNT_TAP_SATOSHIS}
                swapAmountSTRK={SWAP_AMOUNT_STRK.toString()}
                wantedAsset={wantedAsset}
                setWantedAsset={setWantedAsset}
              />

              <div className="w-full max-w-2xl mt-4 flex items-center gap-2">
                <input
                  id="self-accept"
                  type="checkbox"
                  checked={allowSelfAccept}
                  onChange={(e) => setAllowSelfAccept(e.target.checked)}
                />
                <label htmlFor="self-accept" className="text-sm text-gray-700">
                  Test mode: allow accepting my own intention
                </label>
              </div>
            </>
          )}

          {activeTab === 'market' && (
            <SwapIntentionsList
              setSelectedSwapIntention={(intention) => {
                setSelectedSwapIntention(intention);
                // Sync invoice state if already present on Nostr
                if (intention.paymentRequest) setInvoicePaymentRequest(intention.paymentRequest);
                if (intention.paymentHash) setInvoicePaymentHash(intention.paymentHash);

                // Smart Tab Switching: Locker role goes to Execute, others to Claim
                const posterPubkey = intention.posterPubkey || intention.pubkey;
                const isPoster = nostrPubkey === posterPubkey;
                const isAccepter = intention.acceptedByPubkey === nostrPubkey;
                const wantedAsset = intention.wantedAsset || 'STRK';
                const roleForLocker = wantedAsset === 'STRK' ? 'accepter' : 'poster';
                const isLocker = (roleForLocker === 'poster' && isPoster) || (roleForLocker === 'accepter' && isAccepter);

                setActiveTab(isLocker ? 'execute' : 'claim');
              }}
              selectedSwapIntention={selectedSwapIntention}
              setInvoicePaymentRequest={setInvoicePaymentRequest}
              setInvoicePaymentHash={setInvoicePaymentHash}
              setErrorMessage={setErrorMessage}
              setSwapStatus={setSwapStatus}
              starknetAddress={activeStarknetAddress}
              allowSelfAccept={allowSelfAccept}
            />
          )}

          {activeTab === 'execute' && (
            <>
              {selectedSwapIntention ? (
                <>
                  <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-4 border border-white/50">
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                      <div className="bg-indigo-100 text-indigo-600 p-3 rounded-2xl">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800">Next Steps</h2>
                        <p className="text-sm text-slate-500 font-medium">Follow the instructions to proceed with the swap.</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Intention Wants</p>
                        <p className="text-lg font-bold text-indigo-700">{selectedWantedAsset || 'STRK Native'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                        <p className="text-lg font-bold text-slate-700 capitalize">{selectedSwapIntention.status}</p>
                      </div>
                    </div>

                    <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                      <h4 className="text-sm font-bold text-indigo-800 mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Protocol Rule
                      </h4>
                      {selectedWantedAsset === 'STRK' ? (
                        <p className="text-sm text-indigo-700/80 leading-relaxed">
                          The <strong className="text-indigo-900">accepter</strong> generates the invoice, locks STRK, then publishes the invoice. The <strong className="text-indigo-900">poster</strong> pays the invoice and claims STRK.
                        </p>
                      ) : (
                        <p className="text-sm text-indigo-700/80 leading-relaxed">
                          The <strong className="text-indigo-900">poster</strong> generates the invoice, locks STRK, then publishes the invoice. The <strong className="text-indigo-900">accepter</strong> continues after the invoice appears.
                        </p>
                      )}
                    </div>

                    {!isSelectedAccepted && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 flex gap-3 items-start">
                        <div className="text-amber-500 mt-0.5">⚠️</div>
                        <p className="text-sm text-amber-800 font-medium">
                          This intention is still open. It must be accepted in the Market tab before proceeding.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* LOCKER ROLE UI */}
                  {isLockerRoleMatch && (
                    <>
                      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-6 border border-white/50">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="bg-indigo-100 text-indigo-600 w-8 h-8 rounded-lg flex items-center justify-center">⚡</span>
                            Choose Invoice Method
                          </h3>
                        </div>

                        <div className="flex p-1.5 bg-slate-100/80 rounded-2xl mb-8 border border-slate-200/50">
                          <button
                            onClick={() => setInvoiceMethod('lnc')}
                            disabled={!lncIsConnected}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${invoiceMethod === 'lnc'
                              ? 'bg-white text-indigo-700 shadow-md transform scale-[1.02]'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                              } ${!lncIsConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            LNC Node (Auto)
                          </button>
                          <button
                            onClick={() => setInvoiceMethod('manual')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all duration-300 ${invoiceMethod === 'manual'
                              ? 'bg-white text-indigo-700 shadow-md transform scale-[1.02]'
                              : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                              }`}
                          >
                            Manual (Paste)
                          </button>
                        </div>

                        {invoiceMethod === 'lnc' ? (
                          <div className="space-y-5">
                            <button
                              onClick={handleGenerateInvoice}
                              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-2xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                              disabled={!canGenerateInvoice}
                            >
                              <span>Generate Lightning/Taproot Invoice</span>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </button>
                            {!!generateInvoiceDisabledReason && (
                              <p className="text-sm text-slate-500 text-center font-medium bg-slate-50 py-2 rounded-xl">{generateInvoiceDisabledReason}</p>
                            )}

                            {!selectedAsset && isTapdAvailable && (
                              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-center gap-2 text-amber-700 text-sm font-medium">
                                <span>⚠️</span> Please select a Taproot Asset above before generating invoice.
                              </div>
                            )}

                            {!isTapdChannelsAvailable && isTapdAvailable && (
                              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                                <p className="text-sm text-amber-800 flex items-start gap-2">
                                  <span>⚠️</span>
                                  <span><span className="font-bold">Tap Channels service unavailable:</span> falling back to regular Lightning invoice.</span>
                                </p>
                              </div>
                            )}

                            {!isTapdAvailable && (
                              <p className="text-sm text-red-500 text-center font-medium bg-red-50 py-2 rounded-xl border border-red-100">Taproot Assets daemon not available.</p>
                            )}

                            {pendingInvoiceForSelected && (
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-center gap-2 text-blue-700 text-sm font-medium">
                                <span>ℹ️</span> Invoice is local. It will be published after STRK lock.
                              </div>
                            )}

                            {effectiveInvoicePaymentRequest && !manualInvoice && (
                              <div className="mt-6 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100 shadow-sm">
                                <p className="font-bold text-emerald-800 text-sm mb-4 flex items-center gap-2">
                                  <span className="bg-emerald-200 p-1 rounded-full text-emerald-700">✓</span> Invoice Ready
                                </p>
                                <InvoiceDecoder
                                  key={`lnc-${effectiveInvoicePaymentRequest}`}
                                  invoice={effectiveInvoicePaymentRequest}
                                  title="LNC Invoice Details"
                                  lncClient={lncClient}
                                  assetId={FORCED_TAPROOT_ASSET_ID}
                                />
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                              <p className="text-sm text-slate-600 font-medium mb-3">
                                Paste an invoice from Polar or another wallet to continue.
                              </p>
                              <textarea
                                value={manualInvoice}
                                onChange={(e) => setManualInvoice(e.target.value)}
                                placeholder="lnbc... or lnbcrt..."
                                className="w-full p-4 border border-slate-300 rounded-xl font-mono text-sm resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-inner transition-colors"
                              />
                            </div>
                            {manualInvoice && (
                              <div className="flex justify-between items-center px-2">
                                <button
                                  onClick={() => setManualInvoice('')}
                                  className="text-sm text-red-500 hover:text-red-700 font-bold transition"
                                >
                                  Clear Invoice
                                </button>
                                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">Detected {manualInvoice.length} chars</span>
                              </div>
                            )}

                            {manualInvoice && (
                              <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
                                <InvoiceDecoder
                                  key={`manual-${manualInvoice}`}
                                  invoice={manualInvoice}
                                  title="Pasted Invoice Details"
                                  lncClient={lncClient}
                                  assetId={FORCED_TAPROOT_ASSET_ID}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className={`bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-6 border-2 transition-all duration-500 ${effectiveInvoicePaymentHash ? 'border-amber-200/50 opacity-100 hover:shadow-2xl hover:border-amber-300/50' : 'border-slate-100/50 opacity-60 grayscale-[0.2]'}`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`p-3 rounded-2xl ${effectiveInvoicePaymentHash ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                          </div>
                          <h2 className={`text-2xl font-bold ${effectiveInvoicePaymentHash ? 'text-slate-800' : 'text-slate-500'}`}>Final Step: Lock STRK</h2>
                        </div>
                        <p className={`text-sm mb-8 ${effectiveInvoicePaymentHash ? 'text-slate-600' : 'text-slate-400'}`}>
                          Once you have an invoice (via LNC or Manual paste), lock the STRK on-chain to continue the swap.
                        </p>
                        <button
                          onClick={initiateSTRKSwap}
                          className={`w-full font-bold py-4 px-6 rounded-2xl transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-3 ${effectiveInvoicePaymentHash ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                          disabled={!isWalletConnected || !activeStarknetAddress || !canLockStrk}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                          <span>Send Transaction: Lock STRK on Starknet</span>
                        </button>
                        {!!lockStrkDisabledReason && (
                          <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-center gap-2 text-rose-600 text-sm font-medium">
                            <span>⚠️</span> {lockStrkDisabledReason}
                          </div>
                        )}

                        {invoicePreimage && (
                          <div className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-inner">
                            <p className="font-bold text-emerald-800 flex items-center gap-2 mb-3">
                              <span className="text-xl">✨</span> Preimage Revealed:
                            </p>
                            <div className="bg-white/60 p-4 rounded-xl border border-emerald-100">
                              <p className="break-all text-sm text-emerald-700 font-mono">{invoicePreimage}</p>
                            </div>
                            <p className="text-xs text-emerald-600 mt-3 flex items-center gap-1 font-medium">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              Locker: Use this preimage to claim the wanted asset (Taproot/BTC) on Lightning.
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}


                </>
              ) : (
                <div className="bg-white/80 backdrop-blur-lg p-10 rounded-3xl shadow-xl w-full max-w-2xl mt-4 border border-white/50 text-center flex flex-col items-center justify-center">
                  <div className="bg-slate-100/80 p-6 rounded-full mb-4 inline-block">
                    <svg className="w-12 h-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">No Swap Selected</h3>
                  <p className="text-slate-500 font-medium">Head over to the <button onClick={() => setActiveTab('market')} className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2">Market tab</button> and select or accept an intention to continue.</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'claim' && (
            <>
              <ClaimableIntentionsList
                setSelectedSwapIntention={setSelectedSwapIntention}
                selectedSwapIntention={selectedSwapIntention}
                setInvoicePaymentRequest={setInvoicePaymentRequest}
                setInvoicePaymentHash={setInvoicePaymentHash}
                setErrorMessage={setErrorMessage}
                setSwapStatus={setSwapStatus}
                nostrPubkey={nostrPubkey}
                claimedSwapDTags={claimedSwapDTags}
              />

              {selectedSwapIntention && (
                <>
                  {isClaimerRoleMatch ? (
                    <div className="bg-white/80 backdrop-blur-lg p-8 rounded-3xl shadow-xl w-full max-w-2xl mt-6 border-2 border-purple-200/50">
                      <div className="flex items-center justify-between mb-8 border-b border-purple-100 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-purple-100 text-purple-600 p-3 rounded-2xl">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          </div>
                          <h2 className="text-2xl font-bold text-slate-800">Your Action: Claim STRK</h2>
                        </div>
                        <span className="px-4 py-1.5 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 text-xs font-bold rounded-xl uppercase tracking-wider shadow-sm">
                          Role: Claimer
                        </span>
                      </div>



                      {/* Step 1: Verify STRK Lock */}
                      <div className="mb-6 p-6 rounded-2xl border border-slate-200 bg-slate-50 shadow-inner">
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                          <span className="bg-white shadow-sm w-8 h-8 rounded-full flex items-center justify-center text-sm">1️⃣</span>
                          Verify STRK Lock
                        </h3>
                        <p className="text-sm text-slate-600 mb-4 pl-10">
                          Check if the counterparty has locked the STRK on the contract.
                        </p>

                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={verifySTRKLock}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-lg transition duration-200 shadow-md flex items-center gap-2"
                            >
                              <span>🔍</span> Verify Lock
                            </button>
                            {strkLockVerified && (
                              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-100 animate-in fade-in zoom-in duration-300">
                                <span>✅</span> Verified
                              </div>
                            )}
                          </div>

                          {/* Recovery Section */}
                          {!effectiveInvoicePaymentHash && (
                            <div className="mt-2 p-4 bg-amber-50 rounded-lg border border-amber-200 border-dashed">
                              <p className="text-xs font-bold text-amber-800 uppercase mb-2">Rescue: Missing Payment Hash?</p>
                              <p className="text-xs text-amber-700 mb-3">
                                If Nostr hasn't updated yet, paste the **STRK Lock Transaction Hash** below to recover the hashlock directly from the blockchain.
                              </p>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={recoveryTxHash}
                                  onChange={(e) => setRecoveryTxHash(e.target.value)}
                                  placeholder="0x... (Transaction Hash)"
                                  className="flex-1 p-2.5 border border-amber-300 rounded-md text-xs font-mono focus:ring-2 focus:ring-amber-500 outline-none bg-white/50"
                                />
                                <button
                                  onClick={verifySTRKLock}
                                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md transition shadow-sm"
                                >
                                  Import
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Pay Invoice */}
                      <div className={`mb-8 p-6 rounded-2xl border transition-all duration-300 shadow-sm ${strkLockVerified ? 'bg-white border-purple-200' : 'bg-slate-50 border-slate-200 opacity-70 grayscale-[0.2]'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className={`text-lg font-bold flex items-center gap-2 ${strkLockVerified ? 'text-slate-800' : 'text-slate-500'}`}>
                            <span className="bg-white shadow-sm w-8 h-8 rounded-full flex items-center justify-center text-sm">2️⃣</span>
                            Pay Lightning Invoice
                          </h3>
                        </div>
                        {!strkLockVerified && <div className="mt-2 mb-4 p-2.5 bg-amber-50 rounded-xl border border-amber-100 inline-block text-[11px] text-amber-700 font-semibold shadow-inner">⚠️ This step unlocks after verifying the counterparty STRK lock above.</div>}


                        {effectiveInvoicePaymentRequest ? (
                          <div className={`space-y-4 ${!strkLockVerified ? 'pointer-events-none' : ''}`}>
                            <InvoiceDecoder
                              key={`found-${effectiveInvoicePaymentRequest}`}
                              invoice={effectiveInvoicePaymentRequest}
                              title="Found Invoice on Nostr"
                              lncClient={lncClient}
                              assetId={FORCED_TAPROOT_ASSET_ID}
                            />

                            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-inner space-y-4">
                              <div className="flex justify-center items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-wider before:content-[''] before:flex-1 before:h-px before:bg-slate-200 after:content-[''] after:flex-1 after:h-px after:bg-slate-200">Payment Options</div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Option A: Pay via LNC</p>
                                  <button
                                    onClick={handlePayInvoice}
                                    disabled={(!strkLockVerified && !allowSelfAccept) || !isLncApiReady() || isPayingInvoice}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl disabled:opacity-50 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2 transform hover:-translate-y-0.5"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    {isPayingInvoice ? 'Processing...' : 'Pay with LNC Node'}
                                  </button>
                                  {!isLncApiReady() && <p className="text-[10px] text-red-500 mt-2 text-center bg-red-50 p-1 rounded-lg">LNC Node disconnected.</p>}
                                  {allowSelfAccept && !strkLockVerified && (
                                    <p className="text-[10px] text-amber-600 mt-2 text-center font-medium">Test mode: self-payment allowed.</p>
                                  )}
                                </div>

                                <div>
                                  <p className="text-xs font-bold text-slate-500 uppercase mb-2">Option B: Paid Externally?</p>
                                  <p className="text-[10px] text-slate-500 mb-2 leading-tight">
                                    If paid with another wallet, paste the <strong className="text-slate-700">32-byte Preimage (Hex)</strong> below.
                                  </p>
                                  <input
                                    type="text"
                                    value={claimerPreimage}
                                    onChange={(e) => setClaimerPreimage(e.target.value)}
                                    placeholder="Preimage Hex (0x...)"
                                    className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white shadow-inner transition-colors"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className={`p-8 bg-slate-50 rounded-2xl border border-slate-200 shadow-inner text-center ${!strkLockVerified ? 'pointer-events-none' : ''}`}>
                            <div className="flex items-center justify-center w-12 h-12 bg-slate-200 rounded-full mx-auto mb-4 animate-pulse">
                              <svg className="w-6 h-6 text-slate-500 border-b" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                            <p className="text-sm text-slate-700 font-bold">Waiting for Invoice from Poster...</p>
                            <p className="text-xs text-slate-500 mt-2 mb-6 max-w-sm mx-auto">The invoice will appear here automatically once published to Nostr. You can also paste it manually if provided out-of-band.</p>

                            <div className="max-w-md mx-auto space-y-4">
                              <div className="relative">
                                <textarea
                                  value={manualInvoice}
                                  onChange={(e) => setManualInvoice(e.target.value)}
                                  placeholder="Paste lnbc... manually"
                                  className="w-full p-4 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none h-20 bg-white shadow-sm resize-none"
                                />
                                {manualInvoice && (
                                  <button onClick={() => setManualInvoice('')} className="absolute top-2 right-2 p-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">✕</button>
                                )}
                              </div>

                              <div className="pt-4 border-t border-slate-200">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Or, bypass with preimage</p>
                                <input
                                  type="text"
                                  value={claimerPreimage}
                                  onChange={(e) => setClaimerPreimage(e.target.value)}
                                  placeholder="Preimage Hex (0x...)"
                                  className="w-full p-3 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-purple-500 outline-none bg-white shadow-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Step 3: Claim STRK */}
                      <div className={`mb-6 p-6 rounded-2xl border transition-all duration-300 shadow-sm ${claimerPreimage ? 'bg-emerald-50 border-emerald-300 scale-[1.01]' : 'bg-slate-50 border-slate-200 opacity-60 grayscale-[0.2]'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-lg font-bold flex items-center gap-2 ${claimerPreimage ? 'text-slate-800' : 'text-slate-500'}`}>
                            <span className="bg-white shadow-sm w-8 h-8 rounded-full flex items-center justify-center text-sm">3️⃣</span>
                            Final Step: Claim STRK
                          </h3>
                          {claimTxHash && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full uppercase tracking-wider animate-pulse">Success!</span>}
                        </div>
                        <p className={`text-sm mb-6 ${claimerPreimage ? 'text-slate-600' : 'text-slate-400'}`}>
                          Unlock the STRK from the Starknet contract using the Lightning payment preimage.
                        </p>

                        <button
                          onClick={handleClaimSTRK}
                          disabled={!claimerPreimage || isClaimingStrk}
                          className={`w-full font-bold py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 transform hover:-translate-y-0.5 ${claimerPreimage ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg hover:shadow-xl' : 'bg-slate-200 text-slate-400 disabled:opacity-50'}`}
                        >
                          {isClaimingStrk ? (
                            <>
                              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                              Submitting Claim...
                            </>
                          ) : '🎉 Claim STRK'}
                        </button>

                        {claimTxHash && (
                          <div className="mt-6 p-4 bg-white/80 backdrop-blur-sm rounded-xl border border-emerald-200 flex flex-col gap-2 shadow-inner">
                            <div className="flex items-center gap-2 text-emerald-600">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              <p className="text-xs font-bold uppercase tracking-wider">Transaction Broadcast</p>
                            </div>
                            <p className="text-xs text-slate-700 font-mono break-all bg-slate-50 p-2 rounded-lg border border-slate-100">{claimTxHash}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white/80 backdrop-blur-lg p-10 rounded-3xl shadow-xl w-full max-w-2xl mt-4 border border-rose-200/50 flex flex-col items-center justify-center text-center">
                      <div className="bg-rose-100/80 p-5 rounded-full mb-4 inline-block">
                        <svg className="w-10 h-10 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">Role Mismatch</h3>
                      <p className="text-slate-500 font-medium">The selected intention is <strong className="text-slate-700">not claimable by you</strong>. Please check your role for this swap.</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div className="w-full max-w-4xl mt-12 mb-4">
            <div className="bg-indigo-900/5 backdrop-blur-sm border border-indigo-900/10 rounded-2xl p-5 flex items-center justify-between shadow-inner">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-xs font-bold text-indigo-900/60 uppercase tracking-widest">System Status</span>
              </div>
              <div className="text-sm font-medium text-indigo-900/80 truncate max-w-2xl px-4">
                {swapStatus || 'Standing by...'}
              </div>
            </div>
          </div>
        </div >
      </div >
    </div >
  );
}

function App() {
  return (
    <NostrProvider>
      <AppContent />
    </NostrProvider>
  );
}

export default App;
