import { defineConfig } from '@wagmi/cli';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const artifactsRoot = resolve(
  __dirname,
  'p2pix-smart-contracts/artifacts/contracts',
);

const loadAbi = (relPath: string) => {
  const json = JSON.parse(
    readFileSync(resolve(artifactsRoot, relPath), 'utf8'),
  );
  return json.abi as readonly unknown[];
};

export default defineConfig({
  out: 'src/blockchain/abi.ts',
  contracts: [
    { name: 'P2Pix', abi: loadAbi('p2pix.sol/P2PIX.json') as never },
    {
      name: 'Reputation',
      abi: loadAbi('Reputation.sol/Reputation.json') as never,
    },
    {
      name: 'MockToken',
      abi: loadAbi('lib/mock/mockToken.sol/MockToken.json') as never,
    },
  ],
});
