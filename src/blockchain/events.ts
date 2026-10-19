import { useUser } from '@/composables/useUser';
import { formatUnits, toHex, stringToHex } from 'viem';
import type { PublicClient, Address } from 'viem';
import { Networks, findToken } from '@/config/networks';
import { getContract } from './provider';
import { toLock } from './buyerMethods';
import { p2PixAbi } from './abi';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { NetworkConfig, TokenConfig } from '@/model/NetworkEnum';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import { ChainContract } from 'viem';

const getNetworksLiquidity = async (): Promise<void> => {
  const user = useUser();
  const symbol = user.selectedToken.value;
  user.setLoadingNetworkLiquidity(true);

  const depositLists: ValidDeposit[][] = [];

  for (const network of Networks) {
    const token = network.tokens[symbol];
    if (token) depositLists.push(await getValidDeposits(token, network));
  }
  // A token switch while reading started a newer read, which owns the list.
  if (symbol !== user.selectedToken.value) return;

  const allDeposits = depositLists.flat();
  user.setDepositsValidList(allDeposits);
  user.setLoadingNetworkLiquidity(false);
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

const getValidDeposits = async (
  token: TokenConfig,
  network: NetworkConfig,
  contractInfo?: { client: PublicClient; address: Address },
): Promise<ValidDeposit[]> => {
  let client: PublicClient, abi;

  if (contractInfo) {
    ({ client } = contractInfo);
    abi = p2PixAbi;
  } else {
    ({ abi, client } = await getContract(true));
  }

  const body = {
    query: `
      {
        depositAddeds(where: { token: "${token.address}" }) {
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

  // remove doubles from sellers list
  const depositData = await depositLogs.json();
  if (!depositData.data) {
    console.error('Error fetching deposit logs');
    return [];
  }
  const depositAddeds = depositData.data.depositAddeds;
  const uniqueSellers = depositAddeds.reduce(
    (acc: Record<Address, boolean>, deposit: any) => {
      acc[deposit.seller] = true;
      return acc;
    },
    {} as Record<Address, boolean>,
  );

  if (!contractInfo) {
    // Get metamask provider contract
    ({ abi, client } = await getContract(true));
  }

  const depositList: { [key: string]: ValidDeposit } = {};

  const sellersList = Object.keys(uniqueSellers) as Address[];
  // Use multicall to batch all getBalance requests
  const balanceCalls = sellersList.map((seller) => ({
    address: (network.contracts?.p2pix as ChainContract).address,
    abi,
    functionName: 'getBalance',
    args: [seller, token.address],
  }));

  const balanceResults = await client.multicall({
    contracts: balanceCalls as any,
  });

  // Process results into the depositList
  sellersList.forEach((seller, index) => {
    const mappedBalance = balanceResults[index];

    if (!mappedBalance.error && mappedBalance.result) {
      const validDeposit: ValidDeposit = {
        token: token.address,
        blockNumber: 0,
        remaining: Number(
          formatUnits(mappedBalance.result as bigint, token.decimals),
        ),
        seller,
        network,
        participantID: '',
      };
      depositList[seller + token.address] = validDeposit;
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

  const listed = findToken(useUser().network.value, token);
  if (!listed) {
    throw new Error(`O token ${token} da reserva não está listado nesta rede`);
  }

  return {
    lockID,
    amount: Number(formatUnits(amount, listed.decimals)),
    token: listed.symbol,
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
