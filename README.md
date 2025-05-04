By following this guide learn how to improve your Dapp's UX so the users don't have to wait for many confirmations by making use the newest Ethereum feature: EIP-7702.

By using EIP-7702 users can convert their EOAs temprary into smart contracts so they can call miltiple contracts in one single transaction or many other use cases.

EIP-7702 is now live on both Scroll Mainnet and Scroll Sepolia Testnet. This should be available soon on Ethereum Mainnet and other EVM chains.

## How to use

### 1. Install the dependencies

Install foundry, we will delegate to a contract trough foundry's `cast` command on the terminal because there currently isn't a way to do it the wallets.

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

We'll also need npm just to run our app in a simple http webserver. I recommend using nargo.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
nvm install 22
# Now reload your terminal
```

Also, make sure you have a wallet that allows sending messages to EOAs, Metamask is not compatible. So I recommend Rabby wallet exentension.

### 2. Deploy the following contact with your ERC7702 enabled account

The following contract groups many actions into one only account. I used MakerDao's Muticall3 contract but modified so it only allows one address to execute transactions. If we didn't add this anyone could inpersonify you and steal your funds.

Edit `0xYOUR_EOA_ADDRESS` with the wallet that will use it as EIP-7702 delegation and deploy it on Scroll Sepolia Testnet.

```solidity
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
```

### 3. Delegate to it

The following command will delegate your EOA to act as the contract you just deployed. Replace `YOUR_PRIVATE_KEY` with your EOA private key and `0xYOUR_CONTRACT_ADDRESS` with the `Multicall7702` contract address you just deployed.

```bash
cast send --rpc-url https://scroll-public.scroll-testnet.quiknode.pro --private-key YOUR_PRIVATE_KEY  --auth 0xYOUR_CONTRACT_ADDRESS $(cast az)
```

Optionally, run the following the following to check if the delegation was successfull.

```bash
cast code --rpc-url https://scroll-public.scroll-testnet.quiknode.pro 0xYOUR_EOA_ADDRESS
```

It should print something similar to this

```bash
0xef0100YOUR_EOA_ADDRESS
```

Which is the EIP-7702 delegation prefix `0xef0100` followed by your EOA address.

### 4. Run the webapp

Install a simple static webserver.

```bash
npm install -g lite-server
```

Run app.

```bash
lite-server
```

The app should be runnin now at `http://localhost:3000/`. Open it in your browser.

### 5. Try the app

The webapp will run the following:
1. Mint the selected amount of WETH by depositing to Scroll's `0x5300000000000000000000000000000000000004` WETH precompile
1. Approve the newly minted WETH to the Uniswap V3 contracts
1. Swap the WETH tokens for GHO tokens, add them to your wallet at contract address `0xD9692f1748aFEe00FACE2da35242417dd05a8615`

Input your desired amount of WETH to be swaped and click the "One Click Swap" button.


## Take note

Notice some important details of EIP-7702:
* Delegating your EOA to a contract is not yet possible on EVM Wallets this currently has to be done through the terminal
* Wallets should activate wallet delegation, not dApps. This is for security reasons
* When delegating to a smart contract, make sure that it handles proper access control (Ownership) or you might lose your funds
* When delegating to a smart contract only the instructions are "copyed" not the state, the state will be initalizated in blank

## Further reading

* EIP-7702 [specification](https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7702.md)