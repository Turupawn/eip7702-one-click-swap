// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

// An EIP7702 user can deploy and delegate this contract to aggregate multiple transaction into one, like approve and swap tokens in one tx.
// This is based on Makerdao's Multicall3 available at https://github.com/mds1/multicall3/blob/main/src/Multicall3.sol
// The only difference with the original work is that only the deployer can aggregate transactions.
// THIS IS NOT AUDITED. USE IT AT YOUR OWN RISK.

contract Multicall7702 {
    // Notice we declare this as inmmutable, when delegating to a contract a new context is created without the context of all the state
    // Only the bytecode will be delegated so this way we make sure the address is set statically, at compile time
    // Replace YOUR_EOA_ADDRESS with the wallet you will delegate with 7702 to this contract
    address immutable public owner = 0xYOUR_EOA_ADDRESS;

    struct Call3Value {
        address target;
        bool allowFailure;
        uint256 value;
        bytes callData;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    function aggregate3Value(Call3Value[] calldata calls) public payable returns (Result[] memory returnData) {
        require(owner == msg.sender, "Only owner"); // Only the deployer can aggregate txs
        uint256 valAccumulator;
        uint256 length = calls.length;
        returnData = new Result[](length);
        Call3Value calldata calli;
        for (uint256 i = 0; i < length;) {
            Result memory result = returnData[i];
            calli = calls[i];
            uint256 val = calli.value;
            unchecked { valAccumulator += val; }
            (result.success, result.returnData) = calli.target.call{value: val}(calli.callData);
            assembly {
                if iszero(or(calldataload(add(calli, 0x20)), mload(result))) {
                    mstore(0x00, 0x08c379a000000000000000000000000000000000000000000000000000000000)
                    mstore(0x04, 0x0000000000000000000000000000000000000000000000000000000000000020)
                    mstore(0x24, 0x0000000000000000000000000000000000000000000000000000000000000017)
                    mstore(0x44, 0x4d756c746963616c6c333a2063616c6c206661696c6564000000000000000000)
                    revert(0x00, 0x84)
                }
            }
            unchecked { ++i; }
        }
        require(msg.value == valAccumulator, "Multicall3: value mismatch");
    }
}