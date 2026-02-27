use starknet::ContractAddress;
use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp};
use tap_swap_starknet::atomic_swap::{IAtomicSwapDispatcher, IAtomicSwapDispatcherTrait};

fn setup_contracts() -> (ContractAddress, ContractAddress, ContractAddress, ContractAddress) {
    // We would need to deploy a mock ERC20 here for testing.
    // For the sake of the exercise, we can define a Simple ERC20 mock inside the test file
    // But since Starknet Foundry requires real compiled classes, we'll assume we have one
    // or we'll mock the dispatcher calls.
    // Since we don't have a Mock ERC20 compiled, we will inject a dummy address and mock its methods.
    
    // In Snforge we can mock calls. 

    let atomic_swap_class = declare("AtomicSwap").unwrap().contract_class();
    let (atomic_swap_address, _) = atomic_swap_class.deploy(@ArrayTrait::new()).unwrap();

    let alice: ContractAddress = 123.try_into().unwrap();
    let bob: ContractAddress = 456.try_into().unwrap();
    let strk_token: ContractAddress = 0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d.try_into().unwrap();

    (atomic_swap_address, strk_token, alice, bob)
}

#[test]
fn test_initiate_swap() {
    let (atomic_swap_address, strk_token, alice, _bob) = setup_contracts();
    let dispatcher = IAtomicSwapDispatcher { contract_address: atomic_swap_address };

    let hashlock: u256 = 12345;
    let timelock: u64 = 1000;
    let amount: u256 = 100;

    // We use snforge's `mock_call` to simulate the ERC20 transfer_from returning true
    snforge_std::mock_call(strk_token, selector!("transfer_from"), 1_u256, 1);

    start_cheat_caller_address(atomic_swap_address, alice);
    start_cheat_block_timestamp(atomic_swap_address, 500);

    dispatcher.initiate_swap(hashlock, timelock, amount);

    let swap = dispatcher.get_swap(hashlock);
    assert(swap.value == amount, 'wrong amount');
    assert(swap.sender == alice, 'wrong sender');
    assert(swap.hashlock == hashlock, 'wrong hashlock');
    assert(swap.timelock == timelock, 'wrong timelock');
    assert(!swap.claimed, 'should not be claimed');
    assert(!swap.refunded, 'should not be refunded');

    stop_cheat_caller_address(atomic_swap_address);
    stop_cheat_block_timestamp(atomic_swap_address);
}

#[test]
fn test_claim_swap() {
    let (atomic_swap_address, strk_token, alice, bob) = setup_contracts();
    let dispatcher = IAtomicSwapDispatcher { contract_address: atomic_swap_address };

    let secret: u256 = 999;
    let hashlock: u256 = 999; // Since compute_sha256_hash returns the secret itself for now
    let timelock: u64 = 1000;
    let amount: u256 = 100;

    snforge_std::mock_call(strk_token, selector!("transfer_from"), 1_u256, 1);
    snforge_std::mock_call(strk_token, selector!("transfer"), 1_u256, 1);

    start_cheat_caller_address(atomic_swap_address, alice);
    start_cheat_block_timestamp(atomic_swap_address, 500);
    dispatcher.initiate_swap(hashlock, timelock, amount);
    
    // Now Bob claims
    start_cheat_caller_address(atomic_swap_address, bob);
    dispatcher.claim_swap(secret);

    let swap = dispatcher.get_swap(hashlock);
    assert(swap.claimed, 'should be claimed');
}

#[test]
fn test_refund_swap() {
    let (atomic_swap_address, strk_token, alice, _bob) = setup_contracts();
    let dispatcher = IAtomicSwapDispatcher { contract_address: atomic_swap_address };

    let hashlock: u256 = 12345;
    let timelock: u64 = 1000;
    let amount: u256 = 100;

    snforge_std::mock_call(strk_token, selector!("transfer_from"), 1_u256, 1);
    snforge_std::mock_call(strk_token, selector!("transfer"), 1_u256, 1);

    start_cheat_caller_address(atomic_swap_address, alice);
    start_cheat_block_timestamp(atomic_swap_address, 500);
    dispatcher.initiate_swap(hashlock, timelock, amount);
    
    // Fast forward past timelock
    start_cheat_block_timestamp(atomic_swap_address, 1500);
    dispatcher.refund_swap(hashlock);

    let swap = dispatcher.get_swap(hashlock);
    assert(swap.refunded, 'should be refunded');
}
