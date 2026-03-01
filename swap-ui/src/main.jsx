import React from 'react';
import ReactDOM from 'react-dom/client';

import { Buffer } from 'buffer';

window.Buffer = Buffer;

if (typeof window !== 'undefined') {
  window.process = {
    ...window.process,
    env: { ...(window.process?.env || {}) },
    getuid: () => 0,
    getgid: () => 0,
    cwd: () => '/',
  };
}
import App from './App.jsx';
import './index.css';

// Starknet React Imports
import { StarknetConfig, voyager, argent, braavos, useInjectedConnectors, jsonRpcProvider } from '@starknet-react/core';
import { sepolia } from '@starknet-react/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient(); // Initialize QueryClient

// Custom provider to fix "unsupported channel for spec version: 0.8.1"
// because the default publicProvider() in @starknet-react/core hardcodes 0.8.1
// which is now unsupported in starknet.js v9+.
// Custom provider to fix "unsupported channel for spec version: 0.8.1"
// and avoid CORS issues by providing a list of reliable RPCs.
const myProvider = jsonRpcProvider({
  rpc: (chain) => {
    if (chain.id === sepolia.id) {
      return { nodeUrl: 'https://api.zan.top/public/starknet-sepolia/rpc/v0_10' };
    }
    const rpcs = chain.rpcUrls.public.http;
    const nodeUrl = rpcs[Math.floor(Math.random() * rpcs.length)];
    if (!nodeUrl) return null;
    return { nodeUrl };
  }
});

function Root() {
  const { connectors } = useInjectedConnectors({
    recommended: [
      braavos(),
      argent(),
    ],
    includeRecommended: "always",
    order: "random"
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={myProvider}
      connectors={connectors}
      explorer={voyager}
    >
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </StarknetConfig>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Root />
);
