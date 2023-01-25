import type { Event } from "ethers";
import { vi } from "vitest";

export const MockEvents: Event[] = [
    {
        "blockNumber": 1,
        "blockHash": "0x8",
        "transactionIndex": 1,
        "removed": false,
        "address": "0x0",
        "data": "0x0",
        "topics": [
            "0x0",
            "0x0"
        ],
        "transactionHash": "0x0",
        "logIndex": 1,
        "event": "DepositAdded",
        "eventSignature": "DepositAdded(address,uint256,address,uint256)",
        "args": [
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x00"
            },
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x6c6b935b8bbd400000"
            },
        ],
        getBlock: vi.fn(),
        removeListener: vi.fn(),
        getTransaction: vi.fn(),
        getTransactionReceipt: vi.fn(),
    },
    {
        "blockNumber": 2,
        "blockHash": "0x8",
        "transactionIndex": 2,
        "removed": false,
        "address": "0x0",
        "data": "0x0",
        "topics": [
            "0x0",
            "0x0"
        ],
        "transactionHash": "0x0",
        "logIndex": 2,
        "event": "LockAdded",
        "eventSignature": "LockAdded(address,uint256,address,uint256)",
        "args": [
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x00"
            },
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x6c6b935b8bbd400000"
            },
        ],
        getBlock: vi.fn(),
        removeListener: vi.fn(),
        getTransaction: vi.fn(),
        getTransactionReceipt: vi.fn(),
    },
    {
        "blockNumber": 3,
        "blockHash": "0x8",
        "transactionIndex": 3,
        "removed": false,
        "address": "0x0",
        "data": "0x0",
        "topics": [
            "0x0",
            "0x0"
        ],
        "transactionHash": "0x0",
        "logIndex": 3,
        "event": "LockReleased",
        "eventSignature": "LockReleased(address,uint256,address,uint256)",
        "args": [
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x00"
            },
            "0x0",
            {
                "type": "BigNumber",
                "hex": "0x6c6b935b8bbd400000"
            },
        ],
        getBlock: vi.fn(),
        removeListener: vi.fn(),
        getTransaction: vi.fn(),
        getTransactionReceipt: vi.fn(),
    }
  ];