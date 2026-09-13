import deployment from './deployment.json' with { type: 'json' };
import {
  CHAIN_ID,
  PROTOCOL,
  checkEffect,
  isAddress,
  isHash,
  sha256Bytes,
} from './core.ts';
import { receiptState, verifyReceiptCall } from './receipt.ts';
import type {
  Address,
  Argument,
  EffectCheck,
  Operation,
  Pending,
  Provider,
} from './types.ts';

export { deployment };
export function isConfiguredDeployment(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isAddress(candidate.address) &&
    typeof candidate.sourceSha256 === 'string' &&
    /^[a-f0-9]{64}$/.test(candidate.sourceSha256) &&
    candidate.chainId === CHAIN_ID
  );
}
export const configured = isConfiguredDeployment(deployment);
const rawAddress: unknown = deployment.address;
export const contractAddress = isAddress(rawAddress) ? rawAddress : null;
const fail = (message: string): never => {
  throw new Error('ReplyCheck: ' + message);
};
let reader:
  | Promise<ReturnType<(typeof import('genlayer-js'))['createClient']>>
  | undefined;
async function client() {
  if (!configured)
    fail(
      'Live reviews are not enabled yet. Try Reply Gym while the contract is prepared.',
    );
  if (!reader)
    reader = Promise.all([
      import('genlayer-js'),
      import('genlayer-js/chains'),
    ]).then(([sdk, chains]) =>
      sdk.createClient({ chain: chains.studionet, endpoint: deployment.rpc }),
    );
  return reader;
}
export async function read<T>(
  functionName: string,
  args: Argument[] = [],
): Promise<T> {
  const { TransactionHashVariant } = await import('genlayer-js/types');
  return (await (
    await client()
  ).readContract({
    address: contractAddress!,
    functionName,
    args,
    jsonSafeReturn: true,
    transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
  })) as T;
}
export async function verifyDeployment(): Promise<void> {
  const c = await client();
  const [source, protocol] = await Promise.all([
    c.getContractCode(contractAddress!),
    read<{ protocol: string }>('get_protocol'),
  ]);
  if (protocol.protocol !== PROTOCOL)
    fail(
      'This contract uses a different ReplyCheck protocol. Writes are disabled.',
    );
  const hash = await sha256Bytes(new TextEncoder().encode(source));
  if (hash !== deployment.sourceSha256)
    fail('The deployed source does not match this app. Writes are disabled.');
}
export function browserProvider(): Provider | undefined {
  return typeof window === 'undefined'
    ? undefined
    : (window as Window & { ethereum?: Provider }).ethereum;
}
export async function walletState(
  provider: Provider,
): Promise<{ account: Address | null; chainId: number | null }> {
  const [accounts, chain] = await Promise.all([
    provider.request({ method: 'eth_accounts' }),
    provider.request({ method: 'eth_chainId' }),
  ]);
  return {
    account:
      Array.isArray(accounts) && isAddress(accounts[0])
        ? (accounts[0].toLowerCase() as Address)
        : null,
    chainId:
      typeof chain === 'string' && /^0x[\da-f]+$/i.test(chain)
        ? Number.parseInt(chain, 16)
        : null,
  };
}
export async function connectWallet(provider: Provider) {
  await provider.request({ method: 'eth_requestAccounts' });
  return walletState(provider);
}
export async function switchNetwork(provider: Provider) {
  const chainId = '0x' + CHAIN_ID.toString(16);
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId,
          chainName: 'GenLayer Studionet',
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: [deployment.rpc],
        },
      ],
    });
  }
  return walletState(provider);
}
export async function sendOperation(
  provider: Provider,
  account: Address,
  operation: Operation,
  beforeWalletRequest: () => void,
): Promise<Address> {
  await verifyDeployment();
  const state = await walletState(provider);
  if (state.account !== account.toLowerCase())
    fail('Your wallet account changed. Review the action again.');
  if (state.chainId !== CHAIN_ID)
    fail('Switch your wallet to GenLayer Studionet first.');
  const [{ createClient }, { studionet }] = await Promise.all([
    import('genlayer-js'),
    import('genlayer-js/chains'),
  ]);
  type WalletProvider = NonNullable<
    Parameters<typeof createClient>[0]
  >['provider'];
  const wallet = createClient({
    chain: studionet,
    endpoint: deployment.rpc,
    account,
    provider: provider as WalletProvider,
  });
  beforeWalletRequest();
  const hash: unknown = await wallet.writeContract({
    address: contractAddress!,
    functionName: operation.method,
    args: operation.args,
    value: BigInt(0),
    leaderOnly: false,
  });
  if (!isHash(hash))
    return fail(
      'The wallet did not return a valid transaction hash. Check wallet Activity before sending anything again.',
    );
  return hash;
}
export async function verifyEffect(effect: EffectCheck): Promise<unknown> {
  const value = await read(effect.method, effect.args);
  if (!checkEffect(value, effect))
    fail(
      'Execution succeeded, but the expected stored state could not be verified. Keep the hash and refresh; do not resubmit.',
    );
  return value;
}
export async function getReceipt(pending: Pending) {
  if (
    pending.contract !== contractAddress ||
    pending.chainId !== CHAIN_ID ||
    !isHash(pending.hash)
  )
    fail('This recovery record belongs to a different deployment.');
  const receipt = await (
    await client()
  ).request({
    // The SDK's Ethereum formatter drops Studio's numeric zero value. Keep the
    // raw Studio receipt so exact zero-value and final-round checks stay strict.
    method: 'eth_getTransactionByHash',
    params: [pending.hash as import('genlayer-js/types').TransactionHash],
  });
  const state = receiptState(receipt, pending);
  if (
    (state.state === 'success' || state.state === 'failed') &&
    !(await verifyReceiptCall(receipt, pending))
  )
    return {
      receipt,
      state: 'unknown' as const,
      label:
        'Receipt found, but its exact method, arguments and zero-value call are not verified. Keep the recovery record.',
    };
  return { receipt, ...state };
}
