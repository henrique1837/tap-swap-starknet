import { useState, useCallback, useEffect, useRef } from 'react';
import LNC from '@lightninglabs/lnc-web';

export const useLNC = () => {
  const [lncInstance, setLncInstance] = useState(() => new LNC({}));
  const lncRef = useRef(lncInstance);
  const [status, setStatus] = useState(() => {
    if (lncInstance.isConnected) return 'Connected';
    if (lncInstance.credentials.isPaired) return 'Ready to log in';
    return 'Disconnected';
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    lncRef.current = lncInstance;
  }, [lncInstance]);


  // Helper function for initial connection with pairing phrase and password
  const connectWithPairing = useCallback(async (pairingPhrase, password) => {
    const currentLnc = lncRef.current;
    setError(null);
    setStatus('Connecting');
    try {
      // Set credentials on the existing LNC instance
      currentLnc.credentials.pairingPhrase = pairingPhrase;
      currentLnc.credentials.password = password;

      await currentLnc.connect();
      
      // Verify connection by calling a simple RPC, as per demo
      await currentLnc.lnd.lightning.listChannels(); // This will throw if not connected

      setStatus('Connected');
      setError(null);
      return currentLnc;
    } catch (err) {
      console.error('LNC Connect Error (Pairing):', err);
      setError(err.message || "Failed to connect with pairing phrase.");
      setStatus('Error');
      // If pairing fails, ensure credentials are cleared so UI can retry
      currentLnc.credentials.pairingPhrase = '';
      currentLnc.credentials.password = '';
      throw err;
    }
  }, []);

  // Helper function for logging in with only password (for stored sessions)
  const loginWithPassword = useCallback(async (password) => {
    const currentLnc = lncRef.current;
    setError(null);
    setStatus('Connecting');
    try {
      currentLnc.credentials.password = password;
      await currentLnc.connect();

      // Verify connection by calling a simple RPC
      await currentLnc.lnd.lightning.listChannels(); // This will throw if not connected

      setStatus('Connected');
      setError(null);
      return currentLnc;
    } catch (err) {
      console.error('LNC Login Error (Password):', err);
      setError(err.message || "Failed to login with password. Incorrect password or session expired.");
      // Keep paired state so user can retry password without being forced to re-pair.
      setStatus(currentLnc.credentials.isPaired ? 'Ready to log in' : 'Disconnected');
      // If login fails, clear password so user can re-enter or try pairing again
      currentLnc.credentials.password = '';
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    const currentLnc = lncRef.current;
    try {
      if (currentLnc.isConnected) {
        currentLnc.disconnect();
      }
    } catch (err) {
      console.warn('LNC disconnect failed:', err);
    }
    setStatus(currentLnc.credentials.isPaired ? 'Ready to log in' : 'Disconnected');
    setError(null);
  }, []);

  const logout = useCallback(() => {
    const currentLnc = lncRef.current;
    try {
      if (currentLnc.isConnected) {
        currentLnc.disconnect();
      }
    } catch (err) {
      console.warn('LNC disconnect during logout failed:', err);
    }
    // Clear persisted credentials, then rotate to a fresh in-memory LNC client.
    currentLnc.credentials.clear();
    const freshClient = new LNC({});
    lncRef.current = freshClient;
    setLncInstance(freshClient);
    setStatus('Disconnected');
    setError(null);
  }, []);

  return { 
    lnc: lncInstance, // Expose the stable LNC instance
    status, 
    connectWithPairing, 
    loginWithPassword,
    disconnect, 
    logout,
    error,
    isReady: status === 'Connected',
    isPaired: lncInstance.credentials.isPaired || status === 'Connected' || status === 'Ready to log in',
  };
};
