import { sepolia, rootstockTestnet } from "viem/chains";
import { NetworkConfig } from "@/model/NetworkEnum"
// TODO: import addresses from p2pix-smart-contracts deployments

export const Networks: {[key:string]: NetworkConfig} = {
  sepolia: { ...sepolia,
    rpcUrls: { default: { http: [import.meta.env.VITE_SEPOLIA_API_URL]}},
    contracts: { ...sepolia.contracts,
      p2pix: {address:"0xb7cD135F5eFD9760981e02E2a898790b688939fe"} },
    tokens: {
      BRZ: {address:"0x3eBE67A2C7bdB2081CBd34ba3281E90377462289"} },
    subgraphUrls: [import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL]
  },
  rootstockTestnet: { ...rootstockTestnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL]}},
    contracts: { ...rootstockTestnet.contracts,
      p2pix: {address:"0x57Dcba05980761169508886eEdc6f5E7EC0411Dc"} },
    tokens: {
      BRZ: {address:"0xfE841c74250e57640390f46d914C88d22C51e82e"} },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL]
  },
};

export const DEFAULT_NETWORK = Networks.sepolia;
