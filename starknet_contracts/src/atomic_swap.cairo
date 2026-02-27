use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, starknet::Store)]
pub struct Swap {
    pub value: u256,
    pub sender: ContractAddress,
    pub hashlock: u256,
    pub timelock: u64,
    pub claimed: bool,
    pub refunded: bool,
}

#[starknet::interface]
pub trait IAtomicSwap<TContractState> {
    fn initiate_swap(
        ref self: TContractState,
        hashlock: u256,
        timelock: u64,
        amount: u256
    );
    fn claim_swap(
        ref self: TContractState,
        secret: u256
    );
    fn refund_swap(
        ref self: TContractState,
        hashlock: u256
    );
    fn get_swap(
        self: @TContractState,
        hashlock: u256
    ) -> Swap;
}

#[starknet::interface]
pub trait IERC20<TContractState> {
    fn transfer(ref self: TContractState, recipient: ContractAddress, amount: u256) -> bool;
    fn transfer_from(ref self: TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool;
}

#[starknet::contract]
mod AtomicSwap {
    use super::{Swap, IAtomicSwap, IERC20Dispatcher, IERC20DispatcherTrait};
    use core::num::traits::Zero;
    use starknet::{
        ContractAddress, get_caller_address, get_contract_address, get_block_timestamp,
        storage::{
            Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry
        }
    };

    // The STRK token address on Starknet
    const STRK_TOKEN_ADDRESS: felt252 = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d;

    #[storage]
    struct Storage {
        swaps: Map<u256, Swap>,
        strk_token: IERC20Dispatcher,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        SwapInitiated: SwapInitiated,
        SwapClaimed: SwapClaimed,
        SwapRefunded: SwapRefunded,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapInitiated {
        #[key]
        hashlock: u256,
        sender: ContractAddress,
        value: u256,
        timelock: u64,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapClaimed {
        #[key]
        hashlock: u256,
        receiver: ContractAddress,
        secret: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct SwapRefunded {
        #[key]
        hashlock: u256,
        sender: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState) {
        self.strk_token.write(IERC20Dispatcher { contract_address: STRK_TOKEN_ADDRESS.try_into().unwrap() });
    }

    #[abi(embed_v0)]
    impl AtomicSwapImpl of IAtomicSwap<ContractState> {
        fn initiate_swap(
            ref self: ContractState,
            hashlock: u256,
            timelock: u64,
            amount: u256
        ) {
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            assert(amount > 0, 'Amount must be > 0');
            assert(timelock > timestamp, 'Timelock must be in future');
            assert(timelock <= timestamp + 604800, 'Timelock too far'); // 7 days

            let existing_swap = self.swaps.entry(hashlock).read();
            assert(existing_swap.sender.is_zero(), 'Hashlock already in use');

            // Transfer STRK from caller to contract
            self.strk_token.read().transfer_from(caller, get_contract_address(), amount);

            let new_swap = Swap {
                value: amount,
                sender: caller,
                hashlock: hashlock,
                timelock: timelock,
                claimed: false,
                refunded: false,
            };

            self.swaps.entry(hashlock).write(new_swap);

            self.emit(SwapInitiated {
                hashlock: hashlock,
                sender: caller,
                value: amount,
                timelock: timelock,
            });
        }

        fn claim_swap(
            ref self: ContractState,
            secret: u256
        ) {
            let hashlock = self.compute_sha256_hash(secret);
            
            let mut swap = self.swaps.entry(hashlock).read();
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            assert(!swap.sender.is_zero(), 'No swap for this hashlock');
            assert(!swap.claimed, 'Already claimed');
            assert(!swap.refunded, 'Already refunded');
            assert(timestamp < swap.timelock, 'Timelock has passed');

            swap.claimed = true;
            self.swaps.entry(hashlock).write(swap);

            // Transfer STRK to the claimer
            self.strk_token.read().transfer(caller, swap.value);

            self.emit(SwapClaimed {
                hashlock: hashlock,
                receiver: caller,
                secret: secret,
            });
        }

        fn refund_swap(
            ref self: ContractState,
            hashlock: u256
        ) {
            let mut swap = self.swaps.entry(hashlock).read();
            let caller = get_caller_address();
            let timestamp = get_block_timestamp();

            assert(!swap.sender.is_zero(), 'No swap for this hashlock');
            assert(!swap.claimed, 'Already claimed');
            assert(!swap.refunded, 'Already refunded');
            assert(timestamp >= swap.timelock, 'Timelock not passed');
            assert(caller == swap.sender, 'Only sender can refund');

            swap.refunded = true;
            self.swaps.entry(hashlock).write(swap);

            // Transfer STRK back to the sender
            self.strk_token.read().transfer(swap.sender, swap.value);

            self.emit(SwapRefunded {
                hashlock: hashlock,
                sender: swap.sender,
            });
        }

        fn get_swap(
            self: @ContractState,
            hashlock: u256
        ) -> Swap {
            self.swaps.entry(hashlock).read()
        }
    }

    #[generate_trait]
    impl InternalFunctions of InternalFunctionsTrait {
        fn compute_sha256_hash(self: @ContractState, secret: u256) -> u256 {
            // Placeholder:
            secret // This is NOT SHA256, just to pass compilation for now
        }
    }
}
