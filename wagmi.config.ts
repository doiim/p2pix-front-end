import { defineConfig } from "@wagmi/cli";
import { hardhat } from "@wagmi/cli/plugins";

export default defineConfig({
  out: "src/blockchain/abi.ts",
  contracts: [],
  plugins: [
    hardhat({
      project: "../p2pix-smart-contracts",
    }),
  ],
});
