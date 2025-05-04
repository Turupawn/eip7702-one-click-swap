// Connect to Scroll Sepolia
const NETWORK_ID = 534351

const SWAP_ROUTER_02_ADDRESS = "0x17AFD0263D6909Ba1F9a8EAC697f76532365Fb95" // Uniswap V3 Router on Scroll Sepolia
const WETH_ADDRESS = "0x5300000000000000000000000000000000000004" // WETH precompile on Scroll Sepolia
const GHO_ADDRESS = "0xD9692f1748aFEe00FACE2da35242417dd05a8615" // GHO Token on Scroll Sepolia

// ABI paths
const MULTICALL_ABI_PATH = "./json_abi/Multicall.json"
const SWAP_ROUTER_02_ABI_PATH = "./json_abi/SwapRouter02.json"
const WETH_ABI_PATH = "./json_abi/WETH.json"

// Contract instances
var swapRouter02Contract
var wETHContract
var myself

var accounts // Wallet accounts
var web3 // Web3 instance

// Callback function that reloads the page when the account or network changes
function metamaskReloadCallback() {
  window.ethereum.on('accountsChanged', (accounts) => {
    document.getElementById("web3_message").textContent="Se cambió el account, refrescando...";
    window.location.reload()
  })
  window.ethereum.on('networkChanged', (accounts) => {
    document.getElementById("web3_message").textContent="Se el network, refrescando...";
    window.location.reload()
  })
}

// Initialize Web3 instance
const getWeb3 = async () => {
  return new Promise((resolve, reject) => {

    if(document.readyState=="complete")
    {
      if (window.ethereum) {
        const web3 = new Web3(window.ethereum)
        window.location.reload()
        resolve(web3)
      } else {
        reject("must install MetaMask")
        document.getElementById("web3_message").textContent="Error: Porfavor conéctate a Metamask";
      }
    }else
    {
      window.addEventListener("load", async () => {
        if (window.ethereum) {
          const web3 = new Web3(window.ethereum)
          resolve(web3)
        } else {
          reject("must install MetaMask")
          document.getElementById("web3_message").textContent="Error: Please install Metamask";
        }
      });
    }
  });
};

// Loads a contract from an ABI file
const getContract = async (web3, address, abi_path) => {
  const response = await fetch(abi_path);
  const data = await response.json();
  
  const netId = await web3.eth.net.getId();
  contract = new web3.eth.Contract(
    data,
    address
    );
  return contract
}

// Loads the dapp wallet and contract instances
async function loadDapp() {
  metamaskReloadCallback()
  document.getElementById("web3_message").textContent="Please connect to Metamask"
  var awaitWeb3 = async function () {
    web3 = await getWeb3()
    web3.eth.net.getId((err, netId) => {
      if (netId == NETWORK_ID) {
        var awaitContract = async function () {
          swapRouter02Contract = await getContract(web3, SWAP_ROUTER_02_ADDRESS, SWAP_ROUTER_02_ABI_PATH)
          wETHContract = await getContract(web3, WETH_ADDRESS, WETH_ABI_PATH)

          document.getElementById("web3_message").textContent="You are connected to Metamask"
          onContractInitCallback()
          web3.eth.getAccounts(function(err, _accounts){
            accounts = _accounts
            if (err != null)
            {
              console.error("An error occurred: "+err)
            } else if (accounts.length > 0)
            {
              onWalletConnectedCallback()
              document.getElementById("account_address").style.display = "block"
            } else
            {
              document.getElementById("connect_button").style.display = "block"
            }
          });
        };
        awaitContract();
      } else {
        document.getElementById("web3_message").textContent="Please connect to Goerli";
      }
    });
  };
  awaitWeb3();
}

// Connects the webapp to the user's wallet
async function connectWallet() {
  await window.ethereum.request({ method: "eth_requestAccounts" })
  accounts = await web3.eth.getAccounts()
  onWalletConnectedCallback()
}

loadDapp()

// Callback function that initializes the contract instances
const onContractInitCallback = async () => {
  // On this particular case, we don't need to do anything. You usually want to read the contracts state here.
}

// Callback function that initializes the wallet instance
const onWalletConnectedCallback = async () => {
  // Get the wallet instance just like the contract instances because we're using EIP 7702
  myself = await getContract(web3, accounts[0], MULTICALL_ABI_PATH)
}

const oneClickSwap = async (wethAmount) => {
    // Convert WETH amount to wei
    const weiAmount = Web3.utils.toWei(wethAmount, "ether");

    // Prepare deposit() call for WETH
    const depositCall = wETHContract.methods.deposit().encodeABI();

    // Prepare approve() call for WETH -> Router
    const approveCall = wETHContract.methods.approve(
        swapRouter02Contract.options.address,
        weiAmount
    ).encodeABI();

    // Prepare exactInputSingle call for swapRouter02
    const params = {
        tokenIn: WETH_ADDRESS,
        tokenOut: GHO_ADDRESS,
        fee: 3000, // 0.3% fee pool on Uniswap V3
        recipient: accounts[0],
        amountIn: weiAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
    };
    const swapCall = swapRouter02Contract.methods.exactInputSingle(params).encodeABI();

    // Transaction array in the Multicall3 format
    const calls = [
        {
            target: WETH_ADDRESS,
            allowFailure: false,
            value: weiAmount,
            callData: depositCall
        },
        {
            target: WETH_ADDRESS,
            allowFailure: false,
            value: 0,
            callData: approveCall
        },
        {
            target: SWAP_ROUTER_02_ADDRESS,
            allowFailure: false,
            value: 0,
            callData: swapCall
        }
    ];

    // Send multicall to self account
    await myself.methods.aggregate3Value(calls)
        .send({ from: accounts[0], gas: 0, value: weiAmount })
        .on('transactionHash', function(hash){
            document.getElementById("web3_message").textContent="Transferring, approving, and swapping...";
        })
        .on('receipt', function(receipt){
            document.getElementById("web3_message").textContent="Transfer, approve, and swap success!";
        })
        .catch((err) => {
            console.error("Multicall error:", err);
            document.getElementById("web3_message").textContent="Transfer, approve, and swap failed: " + err;
        });
}