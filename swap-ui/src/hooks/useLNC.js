import { useState, useCallback, useEffect, useRef } from 'react';
import LNC from '@lightninglabs/lnc-web';

export const useLNC = () => {
  const lncRef = useRef(new LNC({}));
  const [lncInstance] = useState(lncRef.current);
  const isConnectingRef = useRef(false);
  const [status, setStatus] = useState('Disconnected');
  const [error, setError] = useState(null);

  const checkConnectionStatus = useCallback(() => {
    try {
      if (lncInstance.isConnected) {
        setStatus('Connected');
      } else if (lncInstance.credentials.isPaired) {
        setStatus('Ready to log in');
      } else {
        setStatus('Disconnected');
      }
    } catch (err) {
      console.error('Error checking LNC connection status:', err);
      setStatus('Error checking status');
    }
  }, [lncInstance]);

  useEffect(() => {
    checkConnectionStatus();
  }, [checkConnectionStatus]);

  const ensureCleanConnectionState = useCallback(async () => {
    try {
      if (lncInstance.isConnected) {
        lncInstance.disconnect();
      }
    } catch (err) {
      console.warn('LNC pre-connect disconnect failed:', err);
    }
    // Give the mailbox server a brief moment to release stale stream state.
    await new Promise((resolve) => setTimeout(resolve, 250));
  }, [lncInstance]);

  // Helper function for initial connection with pairing phrase and password
  const connectWithPairing = useCallback(async (pairingPhrase, password) => {
    if (isConnectingRef.current) {
      const inProgressError = new Error('Connection already in progress. Please wait.');
      setError(inProgressError.message);
      throw inProgressError;
    }
    isConnectingRef.current = true;
    setError(null);
    setStatus('Connecting');
    try {
      await ensureCleanConnectionState();

      // Set credentials on the existing LNC instance
      lncInstance.credentials.pairingPhrase = pairingPhrase;
      lncInstance.credentials.password = password;

      await lncInstance.connect();

      // Verify connection by calling a simple RPC, as per demo
      await lncInstance.lnd.lightning.listChannels(); // This will throw if not connected

      setStatus('Connected');
      setError(null);
      return lncInstance;
    } catch (err) {
      console.error('LNC Connect Error (Pairing):', err);
      setError(err.message || "Failed to connect with pairing phrase.");
      setStatus('Error');
      // If pairing fails, ensure credentials are cleared so UI can retry
      lncInstance.credentials.pairingPhrase = '';
      lncInstance.credentials.password = '';
      throw err;
    } finally {
      isConnectingRef.current = false;
    }
  }, [ensureCleanConnectionState, lncInstance]);

  // Helper function for logging in with only password (for stored sessions)
  const loginWithPassword = useCallback(async (password) => {
    if (isConnectingRef.current) {
      const inProgressError = new Error('Connection already in progress. Please wait.');
      setError(inProgressError.message);
      throw inProgressError;
    }
    isConnectingRef.current = true;
    setError(null);
    setStatus('Connecting');
    try {
      await ensureCleanConnectionState();

      lncInstance.credentials.password = password;
      await lncInstance.connect();

      // Verify connection by calling a simple RPC
      await lncInstance.lnd.lightning.listChannels(); // This will throw if not connected

      setStatus('Connected');
      setError(null);
      return lncInstance;
    } catch (err) {
      console.error('LNC Login Error (Password):', err);
      setError(err.message || "Failed to login with password. Incorrect password or session expired.");
      setStatus(lncInstance.credentials.isPaired ? 'Ready to log in' : 'Error');
      // If login fails, clear password so user can re-enter or try pairing again
      lncInstance.credentials.password = '';
      throw err;
    } finally {
      isConnectingRef.current = false;
    }
  }, [ensureCleanConnectionState, lncInstance]);

  const disconnect = useCallback(() => {
    try {
      if (lncInstance.isConnected) {
        lncInstance.disconnect();
      }
    } catch (err) {
      console.warn('LNC disconnect failed:', err);
    }
    setStatus(lncInstance.credentials.isPaired ? 'Ready to log in' : 'Disconnected');
    setError(null);
  }, [lncInstance]);

  const logout = useCallback(() => {
    try {
      if (lncInstance.isConnected) {
        lncInstance.disconnect();
      }
    } catch (err) {
      console.warn('LNC disconnect during logout failed:', err);
    }
    lncInstance.credentials.clear();
    setStatus('Disconnected');
    setError(null);
  }, [lncInstance]);

  return {
    lnc: lncInstance, // Expose the stable LNC instance
    status,
    connectWithPairing,
    loginWithPassword,
    disconnect,
    logout,
    error,
    isReady: status === 'Connected',
    isPaired: lncInstance.credentials.isPaired,
  };
};
