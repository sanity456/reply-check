import { CHAIN_ID, digest, isAddress, isHash, isId } from './core.ts';
import type { Address, Operation, Recovery } from './types.ts';

export function rejected(error: unknown): boolean {
  const e = error as { code?: number; cause?: { code?: number } } | null;
  return e?.code === 4001 || e?.cause?.code === 4001;
}
export async function recoveryFor(
  operation: Operation,
  account: Address,
  contract: Address,
): Promise<Recovery> {
  return {
    account,
    contract,
    chainId: CHAIN_ID,
    method: operation.method,
    title: operation.title,
    workspace: operation.workspace,
    effect: operation.effect,
    startedAt: new Date().toISOString(),
    callDigest: await digest([operation.method, operation.args]),
  };
}
export function parseRecovery(
  raw: string | null,
  contract: string | null,
): Recovery | null {
  if (!raw || !contract) return null;
  try {
    if (raw.length > 12000) return null;
    const p = JSON.parse(raw) as Recovery;
    if (p.hash !== undefined && !isHash(p.hash)) return null;
    if (
      typeof p.callDigest !== 'string' ||
      !/^[a-f0-9]{64}$/.test(p.callDigest)
    )
      return null;
    if (
      !isAddress(p.account) ||
      p.contract !== contract ||
      p.chainId !== CHAIN_ID ||
      !isId(p.workspace) ||
      typeof p.title !== 'string' ||
      typeof p.method !== 'string' ||
      !p.effect ||
      typeof p.effect.method !== 'string' ||
      !Array.isArray(p.effect.args)
    )
      return null;
    if (
      !('equals' in p.effect) &&
      (!p.effect.fields || !Object.keys(p.effect.fields).length)
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
