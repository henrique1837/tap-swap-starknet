# Tap-Swap Starknet: Atomic Swap Proof of Concept

## Overview

**Tap-Swap Starknet** is a Proof of Concept (PoC) demonstrating cross-chain atomic swaps between **Taproot Assets in Lightning Network Channels** and **STRK tokens on Starknet**. 

This repository explores how two completely different blockchain layers (Bitcoin's Lightning Network and Ethereum's Layer-2 Starknet) can interoperate in a trustless manner using Hash Time Locked Contract (HTLC) principles. The application ensures that a trade either executes entirely (both parties get their desired assets) or fails safely (each party gets a refund), maintaining the integrity of atomic swaps without centralized intermediaries.

## Architecture

This project is divided into two primary sub-components:

1.  **Frontend User Interface (`swap-ui/`)**: A React-based decentralized application built with Vite and TailwindCSS. It utilizes `@lightninglabs/lnc-web` to securely connect to Lightning Network nodes and `@starknet-react/core` to interact with Starknet wallets and smart contracts. By bridging these two ecosystems in the browser, users can initiate, monitor, and claim their atomic swaps seamlessly.
2.  **Starknet Smart Contracts (`starknet_contracts/`)**: A Cairo-based smart contract project holding the HTLC logic on the Starknet side. The main contract (`atomic_swap.cairo`) locks STRK tokens using a cryptographic hash and a timelock, waiting for the corresponding Lightning invoice secret to be revealed before releasing funds.

## How It Works

The atomic swap relies on a cryptographic secret and matching time locks.
1.  **Preparation**: The parties agree on an exchange rate (e.g., Taproot Assets for STRK). One party generates a secret and computes its hash.
2.  **Locking on Starknet**: The Starknet participant locks their STRK tokens in the `AtomicSwap` smart contract (`starknet_contracts/src/atomic_swap.cairo`) using the agreed-upon public hash and a specific expiration time (timelock).
3.  **Locking on Lightning/Taproot**: The other participant maps that same hash to a hold invoice or HTLC on the Lightning Network populated with Taproot Assets.
4.  **Claiming**: To claim the Taproot Assets, the Starknet participant must reveal the preimage (the secret). Once the secret is revealed on the Lightning Network, the Taproot Asset holder can use that same secret to pull the STRK tokens from the Starknet smart contract.
5.  **Refunds**: If the transaction is not completed before the timelocks expire, both parties can easily claw back their locked assets.

## Getting Started

To explore or run the PoC locally, navigate to each sub-directory and follow the instructions in their respective README files:

- [Frontend Documentation (swap-ui/README.md)](./swap-ui/README.md)
- [Smart Contract Documentation (starknet_contracts/README.md)](./starknet_contracts/README.md)

## Disclaimer

This is purely a **Proof of Concept**. The code, including the Cairo smart contracts and the frontend, has not been audited. It is not intended for production usage with real mainnet assets. Use at your own risk.
