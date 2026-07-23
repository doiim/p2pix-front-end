import { getContract } from './provider';
import { getActiveAaContext, type AaContext } from './aaAccount';
import {
  assertErc20PaymasterTokenSupported,
  prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation,
  type PreparedErc20Quote,
} from './erc20Paymaster';
import {
  createOrderId,
  requestFirstLockAuthorization,
  type FirstLockAuthorization,
  type ReleaseAuthorization,
} from '@/utils/bbPay';
import {
  type Abi,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  concatHex,
  isAddress,
  isHex,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';

type AaCall = { to: Address; data: Hex; value: bigint };

const FIRST_LOCK_AUTHORIZATION_SUFFIX_TAG = '0x444f49494d464c31' as const; // "DOIIMFL1"

/**
 * Appending this fixed tag + digest to Kernel callData gives the sponsorship
 * webhook a signed, tamper-evident binding to the one-time authorization
 * without publishing the opaque authorizationId on-chain.
 */
export const buildFirstLockAuthorizationSuffix = (
  authorizationId: string,
): Hex =>
  concatHex([
    FIRST_LOCK_AUTHORIZATION_SUFFIX_TAG,
    keccak256(stringToHex(authorizationId)),
  ]);

/** Minimum on-chain window left before a new PIX solicitation is shown. */
export const pixSettlementSafetyBlocks = (chainId: number): bigint => {
  if (chainId === 42161) return 3_600n; // ~15 minutes at ~250 ms/block
  if (chainId === 1) return 300n; // ~1 hour at ~12 seconds/block
  return 300n;
};

/**
 * Read the token's real ERC-20 decimals. P2Pix amounts must never assume 18
 * decimals: a 6-decimal token (e.g. USDC) would be off by 10^12 otherwise.
 */
const readTokenDecimals = (
  client: Pick<PublicClient, 'readContract'>,
  token: Address,
): Promise<number> =>
  client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'decimals',
  });

/** Read a token's decimals over a read-only RPC provider. */
export const getTokenDecimals = async (token: Address): Promise<number> => {
  const { client } = await getContract(true);
  return readTokenDecimals(client, token);
};

export type P2PixLock = {
  lockID: bigint;
  orderId: Hex;
  expirationBlock: bigint;
  currentBlock: bigint;
  pixTarget: Hex;
  amount: bigint;
  token: Address;
  buyer: Address;
  seller: Address;
  contractAddress: Address;
  chainId: number;
};

export type PreparedLock = {
  orderId: Hex;
  seller: Address;
  token: Address;
  amount: bigint;
  contractAddress: Address;
  chainId: number;
  accountAddress?: Address;
  call: AaCall;
  policy: 'sponsored' | 'erc20' | 'self-funded' | 'eoa';
  authorization?: FirstLockAuthorization & { eligible: true };
  quote?: PreparedErc20Quote;
};

export type LockSubmission = {
  lockID: bigint;
  orderId: Hex;
  policy: PreparedLock['policy'];
  userOpHash?: Hex;
  transactionHash?: Hex;
  recovered: boolean;
};

export type PreparedRelease = {
  lock: P2PixLock;
  authorization: ReleaseAuthorization;
  call: AaCall;
  policy: 'erc20' | 'self-funded' | 'eoa';
  quote?: PreparedErc20Quote;
};

export type PersistedLockIntent = {
  version: 1;
  orderId: Hex;
  seller: Address;
  token: Address;
  amount: string;
  chainId: number;
  account: Address;
  contractAddress: Address;
  createdAtMs: number;
  expiresAtMs: number;
};

type LockIntentContext = Omit<
  PersistedLockIntent,
  'version' | 'orderId' | 'createdAtMs' | 'expiresAtMs'
>;

const LOCK_INTENT_STORAGE_KEY = 'p2pix.pending-lock-intent.v1';
const LOCK_INTENT_VALIDITY_MS = 24 * 60 * 60 * 1_000;

const browserStorage = (): Storage => {
  if (typeof window === 'undefined' || !window.localStorage) {
    throw new Error(
      'Persistent storage is required for an idempotent PIX lock',
    );
  }
  return window.localStorage;
};

const parsePersistedLockIntent = (
  value: string | null,
): PersistedLockIntent | undefined => {
  if (!value) return undefined;
  try {
    const record = JSON.parse(value) as Partial<PersistedLockIntent>;
    if (
      record.version !== 1 ||
      typeof record.orderId !== 'string' ||
      !isHex(record.orderId) ||
      record.orderId.length !== 66 ||
      typeof record.seller !== 'string' ||
      !isAddress(record.seller) ||
      typeof record.token !== 'string' ||
      !isAddress(record.token) ||
      typeof record.amount !== 'string' ||
      typeof record.chainId !== 'number' ||
      typeof record.account !== 'string' ||
      !isAddress(record.account) ||
      typeof record.contractAddress !== 'string' ||
      !isAddress(record.contractAddress) ||
      typeof record.createdAtMs !== 'number' ||
      typeof record.expiresAtMs !== 'number'
    ) {
      return undefined;
    }
    return record as PersistedLockIntent;
  } catch {
    return undefined;
  }
};

const sameLockIntent = (
  record: PersistedLockIntent,
  context: LockIntentContext,
  nowMs: number,
): boolean =>
  record.expiresAtMs > nowMs &&
  record.seller.toLowerCase() === context.seller.toLowerCase() &&
  record.token.toLowerCase() === context.token.toLowerCase() &&
  record.amount === context.amount &&
  record.chainId === context.chainId &&
  record.account.toLowerCase() === context.account.toLowerCase() &&
  record.contractAddress.toLowerCase() ===
    context.contractAddress.toLowerCase();

/**
 * Reserve the idempotency key before authorization or submission. The same
 * intent survives reloads and user-cancelled confirmation dialogs; changing
 * any economic or wallet context creates a new order.
 */
export const reserveLockIntent = (
  context: LockIntentContext,
  storage: Storage = browserStorage(),
  nowMs = Date.now(),
): PersistedLockIntent => {
  let current: PersistedLockIntent | undefined;
  try {
    current = parsePersistedLockIntent(
      storage.getItem(LOCK_INTENT_STORAGE_KEY),
    );
  } catch {
    throw new Error('Could not read the idempotent PIX lock intent');
  }
  if (current && sameLockIntent(current, context, nowMs)) return current;

  const record: PersistedLockIntent = {
    version: 1,
    orderId: createOrderId(),
    ...context,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + LOCK_INTENT_VALIDITY_MS,
  };
  try {
    storage.setItem(LOCK_INTENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    throw new Error('Could not persist the idempotent PIX lock intent');
  }
  return record;
};

/** Clear only the completed order, preserving a newer intent from another tab. */
export const clearLockIntent = (orderId: Hex, storage?: Storage): boolean => {
  try {
    const activeStorage = storage ?? browserStorage();
    const current = parsePersistedLockIntent(
      activeStorage.getItem(LOCK_INTENT_STORAGE_KEY),
    );
    if (current?.orderId.toLowerCase() !== orderId.toLowerCase()) return false;
    activeStorage.removeItem(LOCK_INTENT_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
};

const assertSameAaContext = (
  prepared: { chainId: number; accountAddress?: Address },
  aa: AaContext,
): void => {
  if (prepared.chainId !== aa.network.id) {
    throw new Error('Active chain changed after preparing the operation');
  }
  if (
    prepared.accountAddress &&
    prepared.accountAddress.toLowerCase() !== aa.account.address.toLowerCase()
  ) {
    throw new Error(
      'Active Kernel account changed after preparing the operation',
    );
  }
};

export const getLockIdFromLogs = (
  abi: readonly unknown[],
  logs: readonly Log[],
  buyer: Address,
  orderId: Hex,
  contractAddress?: Address,
): bigint => {
  for (const log of logs) {
    if (
      contractAddress &&
      log.address.toLowerCase() !== contractAddress.toLowerCase()
    ) {
      continue;
    }
    try {
      const event = decodeEventLog({
        abi: abi as Abi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName !== 'LockAdded') continue;
      const args = event.args as {
        buyer?: Address;
        lockID?: bigint;
        orderId?: Hex;
      };
      if (
        args.buyer?.toLowerCase() === buyer.toLowerCase() &&
        args.orderId?.toLowerCase() === orderId.toLowerCase() &&
        args.lockID !== undefined
      ) {
        return args.lockID;
      }
    } catch {
      // Receipt contains EntryPoint/Kernel logs as well; ignore unrelated ABIs.
    }
  }
  throw new Error(
    'AA lock succeeded but no matching buyer/order LockAdded event was found',
  );
};

const buildLockCall = (
  address: Address,
  abi: readonly unknown[],
  orderId: Hex,
  sellerAddress: Address,
  tokenAddress: Address,
  amount: bigint,
): AaCall => ({
  to: address,
  data: encodeFunctionData({
    abi: abi as Abi,
    functionName: 'lock',
    args: [orderId, sellerAddress, tokenAddress, amount, [], []],
  }),
  value: 0n,
});

const buildReleaseCall = (
  address: Address,
  abi: readonly unknown[],
  lockID: bigint,
  authorization: ReleaseAuthorization,
): AaCall => ({
  to: address,
  data: encodeFunctionData({
    abi: abi as Abi,
    functionName: 'release',
    args: [
      lockID,
      authorization.pixTimestamp,
      authorization.deadline,
      authorization.signature,
    ],
  }),
  value: 0n,
});

const assertPreparedLockCall = (
  prepared: PreparedLock,
  address: Address,
  abi: readonly unknown[],
): void => {
  const expected = buildLockCall(
    address,
    abi,
    prepared.orderId,
    prepared.seller,
    prepared.token,
    prepared.amount,
  );
  if (
    prepared.call.to.toLowerCase() !== expected.to.toLowerCase() ||
    prepared.call.data.toLowerCase() !== expected.data.toLowerCase() ||
    prepared.call.value !== expected.value
  ) {
    throw new Error('Prepared lock call changed after authorization');
  }
};

const firstLockPaymasterContext = (
  aa: AaContext,
  prepared: PreparedLock,
  authorization: FirstLockAuthorization & { eligible: true },
) => {
  const sponsorshipPolicyId =
    aa.network.aa?.paymasterPolicies.firstLock?.sponsorshipPolicyId;
  if (!sponsorshipPolicyId?.trim()) {
    throw new Error('AA first-lock sponsorship policy is unavailable');
  }

  return {
    sponsorshipPolicyId,
    meta: {
      flow: 'p2pix-first-lock-v1',
      authorizationId: authorization.authorizationId,
      authorizationDigest: keccak256(
        stringToHex(authorization.authorizationId),
      ),
      orderId: prepared.orderId,
      chainId: String(prepared.chainId),
      sender: aa.account.address,
      contractAddress: prepared.contractAddress,
      seller: prepared.seller,
      token: prepared.token,
      amount: prepared.amount.toString(),
    },
  };
};

export const getP2PixLock = async (lockID: bigint): Promise<P2PixLock> => {
  const { address, abi, client } = await getContract(true);
  const [lock, currentBlock, chainId] = await Promise.all([
    client.readContract({
      address,
      abi,
      functionName: 'mapLocks',
      args: [lockID],
    }),
    client.getBlockNumber(),
    client.getChainId(),
  ]);
  const [
    counter,
    orderId,
    expirationBlock,
    pixTarget,
    amount,
    token,
    buyer,
    seller,
  ] = lock;

  return {
    lockID: counter,
    orderId,
    expirationBlock,
    currentBlock,
    pixTarget,
    amount,
    token,
    buyer,
    seller,
    contractAddress: address,
    chainId,
  };
};

/**
 * Reject, with a user-facing reason, a lock that must not receive a new PIX:
 * already released/inactive, too close to expiration, or bound to another order.
 */
export const assertLockAcceptableForPix = (
  lock: P2PixLock,
  orderID?: Hex,
): void => {
  if (lock.amount === 0n) throw new Error('Lock is no longer active');
  if (
    lock.expirationBlock <=
    lock.currentBlock + pixSettlementSafetyBlocks(lock.chainId)
  ) {
    throw new Error('Lock is too close to expiration to safely accept a PIX');
  }
  if (orderID && orderID.toLowerCase() !== lock.orderId.toLowerCase()) {
    throw new Error('Order identifier does not match the on-chain lock');
  }
};

/**
 * Prepare one lock using the authoritative eligibility boundary. A valid
 * positive decision selects the sponsored client; a valid negative decision
 * selects ERC-20 and requires real token balance. Boundary failures throw.
 */
export const prepareLock = async (
  seller: Address,
  token: Address,
  amountInput: number,
): Promise<PreparedLock> => {
  const { address, abi, client, account } = await getContract();
  const decimals = await readTokenDecimals(client, token);
  const amount = parseUnits(amountInput.toString(), decimals);
  const aa = await getActiveAaContext();
  const accountAddress = aa?.account.address ?? account ?? undefined;
  if (!accountAddress) throw new Error('Wallet not connected');
  const chainId = aa?.network.id ?? (await client.getChainId());
  const intent = reserveLockIntent({
    seller,
    token,
    amount: amount.toString(),
    chainId,
    account: accountAddress,
    contractAddress: address,
  });
  const { orderId } = intent;
  const call = buildLockCall(address, abi, orderId, seller, token, amount);
  const prepared = {
    orderId,
    seller,
    token,
    amount,
    contractAddress: address,
    chainId,
    accountAddress,
    call,
  };

  if (!aa) {
    return {
      ...prepared,
      policy: 'eoa',
    };
  }

  if (aa.fundingMode === 'self-funded') {
    return { ...prepared, policy: 'self-funded' };
  }

  await assertErc20PaymasterTokenSupported(aa, token);

  if (aa.sponsorshipMode === 'backend') {
    // Authoritative gate: a valid positive decision sponsors; a valid negative
    // decision selects ERC-20. Boundary failures throw (fail closed).
    const authorization = await requestFirstLockAuthorization({
      orderId,
      chainId: aa.network.id,
      sender: aa.account.address,
      contractAddress: address,
      seller,
      token,
      amount: amount.toString(),
    });

    if (authorization.eligible) {
      return {
        ...prepared,
        policy: 'sponsored',
        authorization,
      };
    }

    const quote = await prepareErc20PaymasterQuote(aa, [call], {
      type: 'existing',
    });
    return {
      ...prepared,
      policy: 'erc20',
      quote,
    };
  }

  // caps-only (backendless): sponsor a p2pix lock only when the account cannot
  // pay the fee token itself — an empty counterfactual account, i.e. the first
  // purchase. Once it holds the token (after a release), it pays in ERC-20. The
  // paid token equals the traded token (asserted above), so the lock token's
  // balance is the fee-token balance. Abuse is bounded by the Pimlico caps.
  const feeTokenBalance = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [aa.account.address],
  });
  if (feeTokenBalance === 0n) {
    return {
      ...prepared,
      policy: 'sponsored',
    };
  }

  const quote = await prepareErc20PaymasterQuote(aa, [call], {
    type: 'existing',
  });
  return {
    ...prepared,
    policy: 'erc20',
    quote,
  };
};

const existingLockForOrder = async (
  orderId: Hex,
  prepared: PreparedLock,
): Promise<bigint> => {
  if (!prepared.accountAddress) {
    throw new Error('Prepared lock is missing its buyer address');
  }
  const { address, abi, client } = await getContract(true);
  if (address.toLowerCase() !== prepared.contractAddress.toLowerCase()) {
    throw new Error('P2Pix contract changed after preparing the lock');
  }
  const lockID = await client.readContract({
    address,
    abi,
    functionName: 'lockIdByBuyerOrderId',
    args: [prepared.accountAddress, orderId],
  });
  if (lockID === 0n) return 0n;

  const lock = await getP2PixLock(lockID);
  if (
    lock.orderId.toLowerCase() !== orderId.toLowerCase() ||
    lock.buyer.toLowerCase() !== prepared.accountAddress.toLowerCase() ||
    lock.seller.toLowerCase() !== prepared.seller.toLowerCase() ||
    lock.token.toLowerCase() !== prepared.token.toLowerCase() ||
    lock.amount !== prepared.amount
  ) {
    throw new Error('Existing orderId is bound to a different lock');
  }
  return lockID;
};

export const submitLock = async (
  prepared: PreparedLock,
): Promise<LockSubmission> => {
  const existingLockID = await existingLockForOrder(prepared.orderId, prepared);
  if (existingLockID !== 0n) {
    clearLockIntent(prepared.orderId);
    return {
      lockID: existingLockID,
      orderId: prepared.orderId,
      policy: prepared.policy,
      recovered: true,
    };
  }

  const { address, abi, wallet, client, account } = await getContract();
  if (address.toLowerCase() !== prepared.contractAddress.toLowerCase()) {
    throw new Error('P2Pix contract changed after preparing the lock');
  }
  assertPreparedLockCall(prepared, address, abi);
  const aa = await getActiveAaContext();

  if (aa) {
    if (prepared.policy === 'eoa') {
      throw new Error('Prepared EOA lock cannot be submitted by an AA session');
    }
    assertSameAaContext(prepared, aa);

    let userOpHash: Hex;
    if (prepared.policy === 'sponsored') {
      if (prepared.authorization) {
        // backend mode: the one-time authorization must still be valid and is
        // bound into the userOp for the Pimlico sponsorship webhook to verify.
        if (
          !prepared.authorization.eligible ||
          prepared.authorization.orderId.toLowerCase() !==
            prepared.orderId.toLowerCase() ||
          prepared.authorization.expiresAtMs <= Date.now()
        ) {
          throw new Error(
            'First-lock sponsorship authorization expired or missing',
          );
        }
        userOpHash = await aa.sponsoredClient.sendUserOperation({
          calls: [prepared.call],
          dataSuffix: buildFirstLockAuthorizationSuffix(
            prepared.authorization.authorizationId,
          ),
          paymasterContext: firstLockPaymasterContext(
            aa,
            prepared,
            prepared.authorization,
          ),
        });
      } else {
        // caps-only mode: no backend authorization; the Pimlico policy caps are
        // the sole gate. The sponsored client already pins the firstLock policy.
        if (aa.sponsorshipMode !== 'caps-only') {
          throw new Error('Sponsored lock is missing its authorization');
        }
        userOpHash = await aa.sponsoredClient.sendUserOperation({
          calls: [prepared.call],
        });
      }
    } else if (prepared.policy === 'erc20') {
      if (!prepared.quote) throw new Error('Paid lock quote is missing');
      userOpHash = await sendPreparedErc20UserOperation(aa, prepared.quote);
    } else {
      if (aa.fundingMode !== 'self-funded') {
        throw new Error('Self-funded lock is only available on local Anvil');
      }
      userOpHash = await aa.sponsoredClient.sendUserOperation({
        calls: [prepared.call],
      });
    }

    const receiptClient =
      prepared.policy === 'erc20' ? aa.erc20Client : aa.sponsoredClient;
    const userOpReceipt = await receiptClient.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    if (!userOpReceipt.success) {
      throw new Error(`AA lock failed: ${userOpHash}`);
    }
    const submission: LockSubmission = {
      lockID: getLockIdFromLogs(
        abi,
        userOpReceipt.receipt.logs,
        aa.account.address,
        prepared.orderId,
        address,
      ),
      orderId: prepared.orderId,
      policy: prepared.policy,
      userOpHash,
      transactionHash: userOpReceipt.receipt.transactionHash,
      recovered: false,
    };
    clearLockIntent(prepared.orderId);
    return submission;
  }

  if (prepared.policy !== 'eoa') {
    throw new Error(
      'AA session disappeared; refusing to change buyer to an EOA',
    );
  }
  if (!wallet) throw new Error('Wallet not connected');
  if ((await client.getChainId()) !== prepared.chainId) {
    throw new Error('Active chain changed after preparing the EOA lock');
  }
  if (
    !account ||
    account.toLowerCase() !== prepared.accountAddress?.toLowerCase()
  ) {
    throw new Error('Active EOA changed after preparing the lock');
  }

  const { result, request } = await client.simulateContract({
    address,
    abi,
    functionName: 'lock',
    args: [
      prepared.orderId,
      prepared.seller,
      prepared.token,
      prepared.amount,
      [],
      [],
    ],
    account,
  });
  const transactionHash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({
    hash: transactionHash,
  });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${receipt.transactionHash}`);
  }

  const submission: LockSubmission = {
    lockID: result,
    orderId: prepared.orderId,
    policy: 'eoa',
    transactionHash,
    recovered: false,
  };
  clearLockIntent(prepared.orderId);
  return submission;
};

export const prepareRelease = async (
  lockID: bigint,
  authorization: ReleaseAuthorization,
): Promise<PreparedRelease> => {
  if (authorization.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    throw new Error('P2Pix release authorization expired');
  }

  const lock = await getP2PixLock(lockID);
  if (lock.amount === 0n) throw new Error('P2Pix lock is no longer active');
  const { abi } = await getContract(true);
  const call = buildReleaseCall(
    lock.contractAddress,
    abi,
    lockID,
    authorization,
  );
  const aa = await getActiveAaContext();

  if (!aa) return { lock, authorization, call, policy: 'eoa' };
  if (lock.buyer.toLowerCase() !== aa.account.address.toLowerCase()) {
    throw new Error('Active Kernel account is not the buyer of this lock');
  }

  if (aa.fundingMode === 'self-funded') {
    return { lock, authorization, call, policy: 'self-funded' };
  }

  const quote = await prepareErc20PaymasterQuote(aa, [call], {
    type: 'incoming',
    token: lock.token,
    amount: lock.amount,
  });
  return { lock, authorization, call, policy: 'erc20', quote };
};

export const submitRelease = async (
  prepared: PreparedRelease,
): Promise<TransactionReceipt> => {
  const aa = await getActiveAaContext();
  if (aa) {
    if (prepared.policy === 'eoa') {
      throw new Error(
        'Prepared EOA release cannot be submitted by an AA session',
      );
    }
    if (
      prepared.lock.chainId !== 0 &&
      prepared.lock.chainId !== aa.network.id
    ) {
      throw new Error('Active chain changed after preparing the release');
    }
    if (
      prepared.lock.buyer.toLowerCase() !== aa.account.address.toLowerCase()
    ) {
      throw new Error(
        'Active Kernel account changed after preparing the release',
      );
    }

    let userOpHash: Hex;
    if (prepared.policy === 'self-funded') {
      if (aa.fundingMode !== 'self-funded') {
        throw new Error('Self-funded release is only available on local Anvil');
      }
      userOpHash = await aa.erc20Client.sendUserOperation({
        calls: [prepared.call],
      });
    } else {
      if (!prepared.quote) throw new Error('Paid release quote is missing');
      userOpHash = await sendPreparedErc20UserOperation(aa, prepared.quote);
    }
    const userOpReceipt = await aa.erc20Client.waitForUserOperationReceipt({
      hash: userOpHash,
    });
    if (!userOpReceipt.success) {
      throw new Error(`AA release failed: ${userOpHash}`);
    }
    return userOpReceipt.receipt;
  }

  if (prepared.policy !== 'eoa') {
    throw new Error('AA session disappeared; refusing EOA release fallback');
  }
  const { address, abi, wallet, client, account } = await getContract();
  if (!wallet) throw new Error('Wallet not connected');
  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'release',
    args: [
      prepared.lock.lockID,
      prepared.authorization.pixTimestamp,
      prepared.authorization.deadline,
      prepared.authorization.signature,
    ],
    account,
  });
  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
};

export const withdrawDeposit = async (
  amount: string,
  token: Address,
): Promise<boolean> => {
  const { address, abi, wallet, client, account } = await getContract();
  if (!wallet) throw new Error('Wallet not connected');
  const decimals = await readTokenDecimals(client, token);

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'withdraw',
    args: [token, parseUnits(amount, decimals), []],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt.status === 'success';
};
