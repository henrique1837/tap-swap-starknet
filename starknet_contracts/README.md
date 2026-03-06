# Atomic Swap Smart Contracts on Starknet

This folder contains the Starknet side of the Taproot to Starknet Atomic Swap Proof of Concept. It implements a Hash Time Locked Contract (HTLC) to securely escrow and release STRK tokens contingent upon unlocking secrets shared from the Lightning Network.

## Overview

In an atomic swap between Taproot Assets (Lightning Network) and STRK (Starknet), one of the counterparties must securely lock their StarKnet assets such that they can only be unlocked if the target preimage (the secret) is revealed, or refunded if a time constraint (timelock) lapses.

This package provides a Cairo smart contract (`src/atomic_swap.cairo`) serving as the escrow wrapper for the STRK tokens. The contract exposes standard HTLC functionality.

## Core Features (`IAtomicSwap`)

The `AtomicSwap` contract uses the `STRK` ERC20 token and enforces the following functionality:

1. **`initiate_swap(hashlock, timelock, amount)`**: Let a user lock up a specified amount of `STRK`. It pulls STRK from the caller into the contract and logs the swap details bound to a specific cryptographic `hashlock` and expiration timestamp (`timelock`).
2. **`claim_swap(secret)`**: Any user in possession of the preimage (`secret`) matching the `hashlock` can execute this function to acquire the locked `STRK`. Executing this releases the tokens and exposes the secret on-chain.
3. **`refund_swap(hashlock)`**: If the swap does not execute (the secret properties are not revealed) and the `timelock` expires, the original sender can reclaim their locked `STRK`.

## Getting Started

This project is built using [Scarb](https://docs.swmansion.com/scarb/) and [Starknet Foundry](https://foundry-rs.github.io/starknet-foundry/).

### Prerequisites

Install [Starknet Foundry](https://github.com/foundry-rs/starknet-foundry), which automatically bundles Scarb.

### Compilation

To compile the Cairo smart contracts, run:
```bash
scarb build
```

This will produce the compiled Sierra class artifacts inside the `target/` directory, ready to be declared and deployed to Starknet.

### Testing

Tests can be executed natively using the `snforge` command from Starknet Foundry:

```bash
snforge test
```
Or use the npm script wrapper:
```bash
scarb test
```

## Security Notice

**This code is a non-audited Proof of Concept.** The current hash computation step within the contract is a placeholder and should be updated out for a robust Keccak/SHA256 STARK-friendly execution in later production iterations. Do not use this contract on the Starknet Mainnet.
