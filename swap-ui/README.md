# Swap UI: Tap-Swap Frontend

This folder contains the frontend application for the Taproot Asset to Starknet token atomic swap Proof of Concept. The goal of this application is to serve as a user interface connecting users to both the Lightning Network (for Taproot Assets) and Starknet (for STRK tokens) simultaneously, orchestrating the atomic swap flow.

## Overview

The user interface bridges two vastly different ecosystems to facilitate an HTLC-based trustless exchange. The application integrates:
- **Lightning Network Node Connect (LNC)** via `@lightninglabs/lnc-web` to interface with the user's Lightning node and manage Taproot assets.
- **Starknet React (`@starknet-react/core`) + starknet.js** to handle user wallet connections (e.g., ArgentX, Braavos) and enact Starknet smart contract interactions.
- **Nostr Tools** (`nostr-tools`) to facilitate out-of-band communication, swap discovery, and intention signaling between peers.

## Tech Stack

- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4
- **Web3 Integrations**:
  - Starknet: `starknet`, `@starknet-react/chains`, `@starknet-react/core`
  - Lightning/Bitcoin: `@lightninglabs/lnc-web`, `light-bolt11-decoder`, `ethereum-cryptography`
  - Decentralized Communications: `nostr-tools`

## Getting Started

### Prerequisites

You will need `Node.js` and a package manager (`pnpm` is recommended based on the lockfile).

### Installation and Running

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Start the development server:
   ```bash
   pnpm run dev
   ```

3. Open your browser and navigate to the local URL provided by Vite (typically `http://localhost:5173`).

### Building for Production

To create a production build:
```bash
pnpm run build
```

The output will be generated in the `dist/` directory.

## App Workflow 

- **Connect Wallets**: A user connects their Starknet wallet (for STRK) and pairs with their Lightning Node using LNC pairings (for Taproot).
- **Find Peers**: Users broadcast their swap intentions or listen for matchable swap intentions through a Nostr relay setup.
- **Execute Swap**: The UI orchestrates the sequence of events. Based on the selected role, the DApp prompts the user first to lock the Starknet Asset or the Taproot Asset, generating or receiving the necessary `hashlock` and `timelock` variables. Once locking is verified, the user is prompted to capture or reveal the secret on the opposing layer.
