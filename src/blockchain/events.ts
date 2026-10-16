import { useUser } from '@/composables/useUser';
import { formatEther, isAddress, toHex } from 'viem';
import type { Address } from 'viem';
import { Networks } from '@/config/networks';
import { getContract, getPublicClient } from './provider';
import { toLock } from './buyerMethods';
import { p2PixAbi } from './abi';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { escapeForGraphQL } from '@/utils/escapeForGraphQL';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import { ChainContract } from 'viem';

const getNetworksLiquidity = async (): Promise<void> => {
  const user = useUser();
  user.setLoadingNetworkLiquidity(true);

  try {
    // Each network is read with its own token, client and subgraph, and one
    // network failing must neither block the others nor read as zero liquidity.
    const results = await Promise.allSettled(
      Networks.map(async (network) =>
        getValidDeposits(
          network.tokens[user.selectedToken.value].address,
          network,
        ),
      ),
    );

    const failedNetworks = Networks.filter((network, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') return false;
      console.error(
        `[liquidity] could not read ${network.name}`,
        result.reason,
      );
      return true;
    });

    user.setDepositsValidList(
      results.flatMap((result) =>
        result.status === 'fulfilled' ? result.value : [],
      ),
    );
    user.setFailedLiquidityNetworks(failedNetworks);
  } finally {
    user.setLoadingNetworkLiquidity(false);
  }
};

const getParticipantID = async (
  seller: Address,
  token: Address,
): Promise<string> => {
  const { address, abi, client } = await getContract();

  const participantIDHex = await client.readContract({
    address,
    abi,
    functionName: 'getPixTarget',
    args: [seller, token],
  });

  // Remove '0x' prefix and convert hex to UTF-8 string
  const hexString =
    typeof participantIDHex === 'string'
      ? participantIDHex
      : toHex(participantIDHex as bigint);
  if (!hexString) throw new Error('Participant ID not found');
  const bytes = new Uint8Array(
    hexString
      .slice(2)
      .match(/.{1,2}/g)!
      .map((byte: string) => parseInt(byte, 16)),
  );
  // Remove null bytes from the end of the string
  return new TextDecoder().decode(bytes).replace(/\0/g, '');
};

const hasSeller = (deposit: unknown): deposit is { seller: Address } =>
  typeof deposit === 'object' &&
  deposit !== null &&
  'seller' in deposit &&
  typeof deposit.seller === 'string' &&
  isAddress(deposit.seller);

// Reads `network` through its own client, P2Pix address and subgraph; nothing
// is taken from the selected chain. Throws when the network cannot be read, so
// an outage is never reported as an empty market.
const getValidDeposits = async (
  token: Address,
  network: NetworkConfig,
): Promise<ValidDeposit[]> => {
  const client = getPublicClient(network.id);
  const p2pixAddress = (network.contracts?.p2pix as ChainContract).address;

  const body = {
    query: `
      {
        depositAddeds(where: { token: "${escapeForGraphQL(token)}" }) {
          seller
          amount
          blockTimestamp
          blockNumber
        }
      }
  `,
  };

  const depositLogs = await fetch(network.subgraphUrls[0], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!depositLogs.ok) {
    throw new Error(`Subgraph ${depositLogs.status} for ${network.name}`);
  }

  const depositData = await depositLogs.json();
  const depositAddeds: unknown = depositData?.data?.depositAddeds;
  if (!Array.isArray(depositAddeds) || !depositAddeds.every(hasSeller)) {
    throw new Error(`Malformed subgraph response for ${network.name}`);
  }

  // remove doubles from sellers list
  const sellersList = [
    ...new Set(depositAddeds.map((deposit) => deposit.seller)),
  ];

  const depositList: { [key: string]: ValidDeposit } = {};

  // Use multicall to batch all getBalance requests
  const balanceResults = await client.multicall({
    contracts: sellersList.map(
      (seller) =>
        ({
          address: p2pixAddress,
          abi: p2PixAbi,
          functionName: 'getBalance',
          args: [seller, token],
        }) as const,
    ),
  });

  // Process results into the depositList
  sellersList.forEach((seller, index) => {
    const mappedBalance = balanceResults[index];

    if (!mappedBalance.error && mappedBalance.result) {
      const validDeposit: ValidDeposit = {
        token,
        blockNumber: 0,
        remaining: Number(formatEther(mappedBalance.result)),
        seller,
        network,
        participantID: '',
      };
      depositList[seller + token] = validDeposit;
    }
  });
  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: bigint,
): Promise<UnreleasedLock> => {
  const { address, abi, client } = await getContract();

  const { amount, token, seller } = toLock(
    await client.readContract({
      address,
      abi,
      functionName: 'mapLocks',
      args: [lockID],
    }),
  );

  return {
    lockID,
    amount: Number(formatEther(amount)),
    tokenAddress: token,
    sellerAddress: seller,
  };
};

export {
  getValidDeposits,
  getNetworksLiquidity,
  getUnreleasedLockById,
  getParticipantID,
};
