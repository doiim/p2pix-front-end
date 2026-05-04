//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// BaseUtils
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const baseUtilsAbi = [
  { type: "error", inputs: [], name: "AddressDenied" },
  { type: "error", inputs: [], name: "AlreadyReleased" },
  { type: "error", inputs: [], name: "AmountNotAllowed" },
  { type: "error", inputs: [], name: "DecOverflow" },
  { type: "error", inputs: [], name: "EmptyPixTarget" },
  { type: "error", inputs: [], name: "InvalidDeposit" },
  { type: "error", inputs: [], name: "InvalidSigner" },
  { type: "error", inputs: [], name: "LengthMismatch" },
  { type: "error", inputs: [], name: "LockExpired" },
  { type: "error", inputs: [], name: "LoopOverflow" },
  { type: "error", inputs: [], name: "MaxBalExceeded" },
  { type: "error", inputs: [], name: "NoTokens" },
  { type: "error", inputs: [], name: "NotEnoughTokens" },
  { type: "error", inputs: [], name: "NotExpired" },
  { type: "error", inputs: [], name: "NotInitialized" },
  { type: "error", inputs: [], name: "OnlySeller" },
  { type: "error", inputs: [], name: "Reentrancy" },
  { type: "error", inputs: [], name: "StaticCallFailed" },
  { type: "error", inputs: [], name: "TokenDenied" },
  { type: "error", inputs: [], name: "TxAlreadyUsed" },
  { type: "error", inputs: [], name: "Unauthorized" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "token",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "AllowedERC20Updated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "FundsWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockID",
        internalType: "uint256",
        type: "uint256",
        indexed: true,
      },
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "blocks",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockBlocksUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReleased",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReturned",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "user", internalType: "address", type: "address", indexed: true },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
    ],
    name: "OwnerUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "reputation",
        internalType: "address",
        type: "address",
        indexed: false,
      },
    ],
    name: "ReputationUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "merkleRoot",
        internalType: "bytes32",
        type: "bytes32",
        indexed: true,
      },
    ],
    name: "RootUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "forwarder",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "TrustedForwarderUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: false },
    ],
    name: "ValidSet",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "signers",
        internalType: "address[]",
        type: "address[]",
        indexed: false,
      },
    ],
    name: "ValidSignersUpdated",
  },
  {
    type: "function",
    inputs: [{ name: "_addr", internalType: "address", type: "address" }],
    name: "_castAddrToKey",
    outputs: [{ name: "_key", internalType: "uint256", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [{ name: "_key", internalType: "uint256", type: "uint256" }],
    name: "_castKeyToAddr",
    outputs: [{ name: "_addr", internalType: "address", type: "address" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [
      { name: "erc20", internalType: "contract ERC20", type: "address" },
    ],
    name: "allowedERC20s",
    outputs: [{ name: "state", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "defaultLockBlocks",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "str", internalType: "string", type: "string" }],
    name: "getStr",
    outputs: [{ name: "strEnc", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [{ name: "forwarder", internalType: "address", type: "address" }],
    name: "isTrustedForwarder",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "reputation",
    outputs: [
      { name: "", internalType: "contract IReputation", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "sellerKey", internalType: "address", type: "address" }],
    name: "sellerAllowList",
    outputs: [{ name: "root", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "_blocks", internalType: "uint256", type: "uint256" }],
    name: "setDefaultLockBlocks",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "setOwner",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "_reputation",
        internalType: "contract IReputation",
        type: "address",
      },
    ],
    name: "setReputation",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "forwarders", internalType: "address[]", type: "address[]" },
      { name: "states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "setTrustedFowarders",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_validSigners", internalType: "address[]", type: "address[]" },
    ],
    name: "setValidSigners",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_tokens", internalType: "contract ERC20[]", type: "address[]" },
      { name: "_states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "tokenSettings",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "trustedForwarders",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "message", internalType: "bytes32", type: "bytes32" }],
    name: "usedTransactions",
    outputs: [{ name: "used", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "signer", internalType: "uint256", type: "uint256" }],
    name: "validBacenSigners",
    outputs: [{ name: "valid", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "withdrawBalance",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ECDSA
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ecdsaAbi = [
  { type: "error", inputs: [], name: "InvalidSignature" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ERC20
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const erc20Abi = [
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "spender",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Approval",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "from", internalType: "address", type: "address", indexed: true },
      { name: "to", internalType: "address", type: "address", indexed: true },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Transfer",
  },
  {
    type: "function",
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "", internalType: "address", type: "address" },
      { name: "", internalType: "address", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "spender", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", internalType: "uint8", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "name",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      { name: "spender", internalType: "address", type: "address" },
      { name: "value", internalType: "uint256", type: "uint256" },
      { name: "deadline", internalType: "uint256", type: "uint256" },
      { name: "v", internalType: "uint8", type: "uint8" },
      { name: "r", internalType: "bytes32", type: "bytes32" },
      { name: "s", internalType: "bytes32", type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "to", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ERC2771Context
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const erc2771ContextAbi = [
  {
    type: "function",
    inputs: [{ name: "forwarder", internalType: "address", type: "address" }],
    name: "isTrustedForwarder",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "trustedForwarders",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EventAndErrors
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const eventAndErrorsAbi = [
  { type: "error", inputs: [], name: "AddressDenied" },
  { type: "error", inputs: [], name: "AlreadyReleased" },
  { type: "error", inputs: [], name: "AmountNotAllowed" },
  { type: "error", inputs: [], name: "DecOverflow" },
  { type: "error", inputs: [], name: "EmptyPixTarget" },
  { type: "error", inputs: [], name: "InvalidDeposit" },
  { type: "error", inputs: [], name: "InvalidSigner" },
  { type: "error", inputs: [], name: "LengthMismatch" },
  { type: "error", inputs: [], name: "LockExpired" },
  { type: "error", inputs: [], name: "LoopOverflow" },
  { type: "error", inputs: [], name: "MaxBalExceeded" },
  { type: "error", inputs: [], name: "NoTokens" },
  { type: "error", inputs: [], name: "NotEnoughTokens" },
  { type: "error", inputs: [], name: "NotExpired" },
  { type: "error", inputs: [], name: "NotInitialized" },
  { type: "error", inputs: [], name: "OnlySeller" },
  { type: "error", inputs: [], name: "StaticCallFailed" },
  { type: "error", inputs: [], name: "TokenDenied" },
  { type: "error", inputs: [], name: "TxAlreadyUsed" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "token",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "AllowedERC20Updated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "FundsWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockID",
        internalType: "uint256",
        type: "uint256",
        indexed: true,
      },
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "blocks",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockBlocksUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReleased",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReturned",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "reputation",
        internalType: "address",
        type: "address",
        indexed: false,
      },
    ],
    name: "ReputationUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "merkleRoot",
        internalType: "bytes32",
        type: "bytes32",
        indexed: true,
      },
    ],
    name: "RootUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "forwarder",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "TrustedForwarderUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: false },
    ],
    name: "ValidSet",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "signers",
        internalType: "address[]",
        type: "address[]",
        indexed: false,
      },
    ],
    name: "ValidSignersUpdated",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// IReputation
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const iReputationAbi = [
  {
    type: "function",
    inputs: [{ name: "_userCredit", internalType: "uint256", type: "uint256" }],
    name: "limiter",
    outputs: [
      { name: "_spendLimit", internalType: "uint256", type: "uint256" },
    ],
    stateMutability: "pure",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// MockToken
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const mockTokenAbi = [
  {
    type: "constructor",
    inputs: [{ name: "supply", internalType: "uint256", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "spender",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Approval",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "from", internalType: "address", type: "address", indexed: true },
      { name: "to", internalType: "address", type: "address", indexed: true },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "Transfer",
  },
  {
    type: "function",
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ name: "", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "", internalType: "address", type: "address" },
      { name: "", internalType: "address", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "spender", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", internalType: "uint8", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "to", internalType: "address[]", type: "address[]" },
      { name: "value", internalType: "uint256", type: "uint256" },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "name",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "owner", internalType: "address", type: "address" },
      { name: "spender", internalType: "address", type: "address" },
      { name: "value", internalType: "uint256", type: "uint256" },
      { name: "deadline", internalType: "uint256", type: "uint256" },
      { name: "v", internalType: "uint8", type: "uint8" },
      { name: "r", internalType: "bytes32", type: "bytes32" },
      { name: "s", internalType: "bytes32", type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", internalType: "string", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "to", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "from", internalType: "address", type: "address" },
      { name: "to", internalType: "address", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Multicall
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const multicallAbi = [
  { type: "constructor", inputs: [], stateMutability: "payable" },
  {
    type: "error",
    inputs: [{ name: "reason", internalType: "string", type: "string" }],
    name: "CallFailed",
  },
  {
    type: "function",
    inputs: [
      {
        name: "calls",
        internalType: "struct Multicall.Call[]",
        type: "tuple[]",
        components: [
          { name: "target", internalType: "address", type: "address" },
          { name: "callData", internalType: "bytes", type: "bytes" },
        ],
      },
    ],
    name: "mtc1",
    outputs: [
      { name: "", internalType: "uint256", type: "uint256" },
      { name: "", internalType: "bytes[]", type: "bytes[]" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "calls",
        internalType: "struct Multicall.Call[]",
        type: "tuple[]",
        components: [
          { name: "target", internalType: "address", type: "address" },
          { name: "callData", internalType: "bytes", type: "bytes" },
        ],
      },
    ],
    name: "mtc2",
    outputs: [
      { name: "", internalType: "uint256", type: "uint256" },
      { name: "", internalType: "bytes32", type: "bytes32" },
      {
        name: "",
        internalType: "struct Multicall.Result[]",
        type: "tuple[]",
        components: [
          { name: "success", internalType: "bool", type: "bool" },
          { name: "returnData", internalType: "bytes", type: "bytes" },
        ],
      },
    ],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Owned
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ownedAbi = [
  { type: "error", inputs: [], name: "Unauthorized" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "user", internalType: "address", type: "address", indexed: true },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
    ],
    name: "OwnerUpdated",
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "setOwner",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// OwnerSettings
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const ownerSettingsAbi = [
  { type: "error", inputs: [], name: "AddressDenied" },
  { type: "error", inputs: [], name: "AlreadyReleased" },
  { type: "error", inputs: [], name: "AmountNotAllowed" },
  { type: "error", inputs: [], name: "DecOverflow" },
  { type: "error", inputs: [], name: "EmptyPixTarget" },
  { type: "error", inputs: [], name: "InvalidDeposit" },
  { type: "error", inputs: [], name: "InvalidSigner" },
  { type: "error", inputs: [], name: "LengthMismatch" },
  { type: "error", inputs: [], name: "LockExpired" },
  { type: "error", inputs: [], name: "LoopOverflow" },
  { type: "error", inputs: [], name: "MaxBalExceeded" },
  { type: "error", inputs: [], name: "NoTokens" },
  { type: "error", inputs: [], name: "NotEnoughTokens" },
  { type: "error", inputs: [], name: "NotExpired" },
  { type: "error", inputs: [], name: "NotInitialized" },
  { type: "error", inputs: [], name: "OnlySeller" },
  { type: "error", inputs: [], name: "StaticCallFailed" },
  { type: "error", inputs: [], name: "TokenDenied" },
  { type: "error", inputs: [], name: "TxAlreadyUsed" },
  { type: "error", inputs: [], name: "Unauthorized" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "token",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "AllowedERC20Updated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "FundsWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockID",
        internalType: "uint256",
        type: "uint256",
        indexed: true,
      },
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "blocks",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockBlocksUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReleased",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReturned",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "user", internalType: "address", type: "address", indexed: true },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
    ],
    name: "OwnerUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "reputation",
        internalType: "address",
        type: "address",
        indexed: false,
      },
    ],
    name: "ReputationUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "merkleRoot",
        internalType: "bytes32",
        type: "bytes32",
        indexed: true,
      },
    ],
    name: "RootUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "forwarder",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "TrustedForwarderUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: false },
    ],
    name: "ValidSet",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "signers",
        internalType: "address[]",
        type: "address[]",
        indexed: false,
      },
    ],
    name: "ValidSignersUpdated",
  },
  {
    type: "function",
    inputs: [
      { name: "erc20", internalType: "contract ERC20", type: "address" },
    ],
    name: "allowedERC20s",
    outputs: [{ name: "state", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "defaultLockBlocks",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "forwarder", internalType: "address", type: "address" }],
    name: "isTrustedForwarder",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "reputation",
    outputs: [
      { name: "", internalType: "contract IReputation", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "sellerKey", internalType: "address", type: "address" }],
    name: "sellerAllowList",
    outputs: [{ name: "root", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "_blocks", internalType: "uint256", type: "uint256" }],
    name: "setDefaultLockBlocks",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "setOwner",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "_reputation",
        internalType: "contract IReputation",
        type: "address",
      },
    ],
    name: "setReputation",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "forwarders", internalType: "address[]", type: "address[]" },
      { name: "states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "setTrustedFowarders",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_validSigners", internalType: "address[]", type: "address[]" },
    ],
    name: "setValidSigners",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_tokens", internalType: "contract ERC20[]", type: "address[]" },
      { name: "_states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "tokenSettings",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "trustedForwarders",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "signer", internalType: "uint256", type: "uint256" }],
    name: "validBacenSigners",
    outputs: [{ name: "valid", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "withdrawBalance",
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// P2PIX
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const p2PixAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "defaultBlocks", internalType: "uint256", type: "uint256" },
      { name: "validSigners", internalType: "address[]", type: "address[]" },
      { name: "_reputation", internalType: "address", type: "address" },
      { name: "tokens", internalType: "contract ERC20[]", type: "address[]" },
      { name: "tokenStates", internalType: "bool[]", type: "bool[]" },
    ],
    stateMutability: "payable",
  },
  { type: "error", inputs: [], name: "AddressDenied" },
  { type: "error", inputs: [], name: "AlreadyReleased" },
  { type: "error", inputs: [], name: "AmountNotAllowed" },
  { type: "error", inputs: [], name: "DecOverflow" },
  { type: "error", inputs: [], name: "EmptyPixTarget" },
  { type: "error", inputs: [], name: "InvalidDeposit" },
  { type: "error", inputs: [], name: "InvalidSigner" },
  { type: "error", inputs: [], name: "LengthMismatch" },
  { type: "error", inputs: [], name: "LockExpired" },
  { type: "error", inputs: [], name: "LoopOverflow" },
  { type: "error", inputs: [], name: "MaxBalExceeded" },
  { type: "error", inputs: [], name: "NoTokens" },
  { type: "error", inputs: [], name: "NotEnoughTokens" },
  { type: "error", inputs: [], name: "NotExpired" },
  { type: "error", inputs: [], name: "NotInitialized" },
  { type: "error", inputs: [], name: "OnlySeller" },
  { type: "error", inputs: [], name: "Reentrancy" },
  { type: "error", inputs: [], name: "StaticCallFailed" },
  { type: "error", inputs: [], name: "TokenDenied" },
  { type: "error", inputs: [], name: "TxAlreadyUsed" },
  { type: "error", inputs: [], name: "Unauthorized" },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "token",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "AllowedERC20Updated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "DepositWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "owner",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "FundsWithdrawn",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockID",
        internalType: "uint256",
        type: "uint256",
        indexed: true,
      },
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockAdded",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "blocks",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockBlocksUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
      {
        name: "amount",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReleased",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "buyer",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "lockId",
        internalType: "uint256",
        type: "uint256",
        indexed: false,
      },
    ],
    name: "LockReturned",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      { name: "user", internalType: "address", type: "address", indexed: true },
      {
        name: "newOwner",
        internalType: "address",
        type: "address",
        indexed: true,
      },
    ],
    name: "OwnerUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "reputation",
        internalType: "address",
        type: "address",
        indexed: false,
      },
    ],
    name: "ReputationUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "merkleRoot",
        internalType: "bytes32",
        type: "bytes32",
        indexed: true,
      },
    ],
    name: "RootUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "forwarder",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: true },
    ],
    name: "TrustedForwarderUpdated",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "seller",
        internalType: "address",
        type: "address",
        indexed: true,
      },
      {
        name: "token",
        internalType: "contract ERC20",
        type: "address",
        indexed: false,
      },
      { name: "state", internalType: "bool", type: "bool", indexed: false },
    ],
    name: "ValidSet",
  },
  {
    type: "event",
    anonymous: false,
    inputs: [
      {
        name: "signers",
        internalType: "address[]",
        type: "address[]",
        indexed: false,
      },
    ],
    name: "ValidSignersUpdated",
  },
  {
    type: "function",
    inputs: [{ name: "_addr", internalType: "address", type: "address" }],
    name: "_castAddrToKey",
    outputs: [{ name: "_key", internalType: "uint256", type: "uint256" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [{ name: "_key", internalType: "uint256", type: "uint256" }],
    name: "_castKeyToAddr",
    outputs: [{ name: "_addr", internalType: "address", type: "address" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [
      { name: "erc20", internalType: "contract ERC20", type: "address" },
    ],
    name: "allowedERC20s",
    outputs: [{ name: "state", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "defaultLockBlocks",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "pixTarget", internalType: "string", type: "string" },
      { name: "allowlistRoot", internalType: "bytes32", type: "bytes32" },
      { name: "token", internalType: "contract ERC20", type: "address" },
      { name: "amount", internalType: "uint96", type: "uint96" },
      { name: "valid", internalType: "bool", type: "bool" },
    ],
    name: "deposit",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "seller", internalType: "address", type: "address" },
      { name: "token", internalType: "contract ERC20", type: "address" },
    ],
    name: "getBalance",
    outputs: [{ name: "bal", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "sellers", internalType: "address[]", type: "address[]" },
      { name: "token", internalType: "contract ERC20", type: "address" },
    ],
    name: "getBalances",
    outputs: [{ name: "", internalType: "uint256[]", type: "uint256[]" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "ids", internalType: "uint256[]", type: "uint256[]" }],
    name: "getLocksStatus",
    outputs: [
      { name: "", internalType: "uint256[]", type: "uint256[]" },
      {
        name: "",
        internalType: "enum DataTypes.LockStatus[]",
        type: "uint8[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "seller", internalType: "address", type: "address" },
      { name: "token", internalType: "contract ERC20", type: "address" },
    ],
    name: "getPixTarget",
    outputs: [{ name: "pixTarget", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "seller", internalType: "address", type: "address" },
      { name: "token", internalType: "contract ERC20", type: "address" },
    ],
    name: "getPixTargetString",
    outputs: [{ name: "pixTarget", internalType: "string", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "str", internalType: "string", type: "string" }],
    name: "getStr",
    outputs: [{ name: "strEnc", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [
      { name: "seller", internalType: "address", type: "address" },
      { name: "token", internalType: "contract ERC20", type: "address" },
    ],
    name: "getValid",
    outputs: [{ name: "valid", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "forwarder", internalType: "address", type: "address" }],
    name: "isTrustedForwarder",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "seller", internalType: "address", type: "address" },
      { name: "token", internalType: "contract ERC20", type: "address" },
      { name: "amount", internalType: "uint80", type: "uint80" },
      { name: "merkleProof", internalType: "bytes32[]", type: "bytes32[]" },
      { name: "expiredLocks", internalType: "uint256[]", type: "uint256[]" },
    ],
    name: "lock",
    outputs: [{ name: "lockID", internalType: "uint256", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "lockCounter",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    name: "mapLocks",
    outputs: [
      { name: "counter", internalType: "uint256", type: "uint256" },
      { name: "expirationBlock", internalType: "uint256", type: "uint256" },
      { name: "pixTarget", internalType: "bytes32", type: "bytes32" },
      { name: "amount", internalType: "uint80", type: "uint80" },
      { name: "token", internalType: "contract ERC20", type: "address" },
      { name: "buyerAddress", internalType: "address", type: "address" },
      { name: "seller", internalType: "address", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "owner",
    outputs: [{ name: "", internalType: "address", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "lockID", internalType: "uint256", type: "uint256" },
      { name: "pixTimestamp", internalType: "bytes32", type: "bytes32" },
      { name: "signature", internalType: "bytes", type: "bytes" },
    ],
    name: "release",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "reputation",
    outputs: [
      { name: "", internalType: "contract IReputation", type: "address" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "sellerKey", internalType: "address", type: "address" }],
    name: "sellerAllowList",
    outputs: [{ name: "root", internalType: "bytes32", type: "bytes32" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "_blocks", internalType: "uint256", type: "uint256" }],
    name: "setDefaultLockBlocks",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "newOwner", internalType: "address", type: "address" }],
    name: "setOwner",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      {
        name: "_reputation",
        internalType: "contract IReputation",
        type: "address",
      },
    ],
    name: "setReputation",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "addr", internalType: "address", type: "address" },
      { name: "merkleroot", internalType: "bytes32", type: "bytes32" },
    ],
    name: "setRoot",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "forwarders", internalType: "address[]", type: "address[]" },
      { name: "states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "setTrustedFowarders",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_validSigners", internalType: "address[]", type: "address[]" },
    ],
    name: "setValidSigners",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "token", internalType: "contract ERC20", type: "address" },
      { name: "state", internalType: "bool", type: "bool" },
    ],
    name: "setValidState",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [
      { name: "_tokens", internalType: "contract ERC20[]", type: "address[]" },
      { name: "_states", internalType: "bool[]", type: "bool[]" },
    ],
    name: "tokenSettings",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "address", type: "address" }],
    name: "trustedForwarders",
    outputs: [{ name: "", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "lockIDs", internalType: "uint256[]", type: "uint256[]" }],
    name: "unlockExpired",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [{ name: "message", internalType: "bytes32", type: "bytes32" }],
    name: "usedTransactions",
    outputs: [{ name: "used", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    name: "userRecord",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [{ name: "signer", internalType: "uint256", type: "uint256" }],
    name: "validBacenSigners",
    outputs: [{ name: "valid", internalType: "bool", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [
      { name: "token", internalType: "contract ERC20", type: "address" },
      { name: "amount", internalType: "uint256", type: "uint256" },
      { name: "expiredLocks", internalType: "uint256[]", type: "uint256[]" },
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    inputs: [],
    name: "withdrawBalance",
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "receive", stateMutability: "payable" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ReentrancyGuard
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const reentrancyGuardAbi = [
  { type: "error", inputs: [], name: "Reentrancy" },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Reputation
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const reputationAbi = [
  { type: "constructor", inputs: [], stateMutability: "payable" },
  {
    type: "function",
    inputs: [{ name: "_userCredit", internalType: "uint256", type: "uint256" }],
    name: "limiter",
    outputs: [
      { name: "_spendLimit", internalType: "uint256", type: "uint256" },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    inputs: [],
    name: "magicValue",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    inputs: [],
    name: "maxLimit",
    outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SafeTransferLib
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export const safeTransferLibAbi = [
  { type: "error", inputs: [], name: "ETHTransferFailed" },
  { type: "error", inputs: [], name: "TransferFailed" },
  { type: "error", inputs: [], name: "TransferFromFailed" },
] as const;
