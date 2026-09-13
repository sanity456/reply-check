import type { Pending } from './types.ts';
import { digest } from './core.ts';
type RecordValue = Record<string, unknown>;
const object = (v: unknown): RecordValue =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as RecordValue)
    : {};
const statusNumbers = [
  'UNINITIALIZED',
  'PENDING',
  'PROPOSING',
  'COMMITTING',
  'REVEALING',
  'ACCEPTED',
  'UNDETERMINED',
  'FINALIZED',
  'CANCELED',
  'APPEAL_REVEALING',
  'APPEAL_COMMITTING',
  'READY_TO_FINALIZE',
  'VALIDATORS_TIMEOUT',
  'LEADER_TIMEOUT',
];
export type ReceiptState = {
  state: 'pending' | 'success' | 'failed' | 'unknown';
  label: string;
};
function studioFinalOutcome(tx: RecordValue): string | undefined {
  const consensus = object(tx.consensus_data);
  const history = object(tx.consensus_history);
  const rounds = Array.isArray(history.consensus_results)
    ? history.consensus_results
    : [];
  const last = object(rounds.at(-1));
  const changes = Array.isArray(history.current_status_changes)
    ? history.current_status_changes
    : [];
  const accepted = Array.isArray(last.status_changes)
    ? last.status_changes
    : [];
  const round = object(tx.last_round);
  const validators = Array.isArray(round.round_validators)
    ? round.round_validators
    : [];
  const leaderIndex = Number(round.leader_index);
  if (
    !rounds.length ||
    (consensus.final !== undefined && consensus.final !== true) ||
    changes.at(-1) !== 'FINALIZED' ||
    last.consensus_round !== 'Accepted' ||
    accepted.at(-1) !== 'ACCEPTED' ||
    !['MAJORITY_AGREE', 'AGREE'].includes(String(tx.result_name)) ||
    tx.result !== round.result ||
    typeof tx.last_leader !== 'string' ||
    !Number.isInteger(leaderIndex) ||
    leaderIndex < 0 ||
    typeof validators[leaderIndex] !== 'string' ||
    (validators[leaderIndex] as string).toLowerCase() !==
      tx.last_leader.toLowerCase()
  )
    return;
  const current = Array.isArray(consensus.leader_receipt)
    ? consensus.leader_receipt
    : [];
  const historical = Array.isArray(last.leader_result)
    ? last.leader_result
    : [];
  // Studio also places idle validator records in leader_receipt. Bind the unique
  // actual leader to the final accepted round; never pick an arbitrary success.
  const actual = current.filter((r) => object(r).mode === 'leader');
  const previous = historical.filter((r) => object(r).mode === 'leader');
  if (actual.length !== 1 || previous.length !== 1) return;
  const a = object(actual[0]),
    b = object(previous[0]);
  const resultBytes = (r: RecordValue) =>
    typeof r.result === 'string' ? r.result : object(r.result).raw;
  const aAddress = object(a.node_config).address,
    bAddress = object(b.node_config).address;
  if (
    typeof aAddress !== 'string' ||
    typeof bAddress !== 'string' ||
    aAddress.toLowerCase() !== tx.last_leader.toLowerCase() ||
    bAddress.toLowerCase() !== tx.last_leader.toLowerCase() ||
    a.execution_result !== b.execution_result ||
    typeof resultBytes(a) !== 'string' ||
    resultBytes(a) !== resultBytes(b)
  )
    return;
  try {
    const bytes = resultBytes(a) as string;
    if (bytes.length > 320000) return;
    const kind = atob(bytes).charCodeAt(0);
    const resultStatus = ['return', 'rollback', 'contract_error', 'error'][
      kind
    ];
    const outcome =
      kind === 0 ? 'SUCCESS' : [1, 2, 3].includes(kind) ? 'ERROR' : undefined;
    for (const candidate of [a, b]) {
      const declared = object(candidate.result).status;
      if (declared !== undefined && declared !== resultStatus) return;
    }
    return a.execution_result === outcome ? outcome : undefined;
  } catch {
    return;
  }
}
export function receiptState(
  input: unknown,
  pending: Pick<Pending, 'hash' | 'account' | 'contract'>,
): ReceiptState {
  const tx = object(input);
  for (const [keys, expected] of [
    [['hash', 'txId', 'tx_id'], pending.hash],
    [['from_address', 'sender'], pending.account],
    [['to_address', 'recipient'], pending.contract],
  ] as const) {
    const present = keys.map((k) => tx[k]).filter((v) => v !== undefined);
    if (
      !present.length ||
      present.some(
        (v) =>
          typeof v !== 'string' || v.toLowerCase() !== expected.toLowerCase(),
      )
    )
      return {
        state: 'unknown',
        label: 'Receipt identity is missing or conflicting.',
      };
  }
  const hash = tx.hash ?? tx.txId;
  const sender = tx.from_address ?? tx.sender;
  const recipient = tx.to_address ?? tx.recipient;
  if (
    typeof hash !== 'string' ||
    hash.toLowerCase() !== pending.hash.toLowerCase() ||
    typeof sender !== 'string' ||
    sender.toLowerCase() !== pending.account.toLowerCase() ||
    typeof recipient !== 'string' ||
    recipient.toLowerCase() !== pending.contract.toLowerCase()
  ) {
    return {
      state: 'unknown',
      label: 'Receipt identity could not be verified.',
    };
  }
  const status =
    typeof tx.statusName === 'string'
      ? tx.statusName
      : typeof tx.status === 'number'
        ? statusNumbers[tx.status]
        : tx.status;
  const secondaryStatus =
    typeof tx.status === 'number' ? statusNumbers[tx.status] : tx.status;
  if (
    tx.statusName !== undefined &&
    secondaryStatus !== undefined &&
    tx.statusName !== secondaryStatus
  )
    return { state: 'unknown', label: 'Receipt lifecycle fields conflict.' };
  if (status === 'CANCELED')
    return { state: 'failed', label: 'The network canceled this transaction.' };
  if (status !== 'FINALIZED')
    return {
      state: 'pending',
      label:
        typeof status === 'string'
          ? status.replaceAll('_', ' ').toLowerCase()
          : 'waiting for network status',
    };
  const history = object(tx.consensus_history);
  const finalRound = object(tx.last_round);
  const rounds = Array.isArray(history.consensus_results)
    ? history.consensus_results
    : [];
  const lastRound = object(rounds.at(-1));
  const lastChanges = Array.isArray(lastRound.status_changes)
    ? lastRound.status_changes
    : [];
  const finalChanges = Array.isArray(history.current_status_changes)
    ? history.current_status_changes
    : [];
  if (
    tx.result === 7 &&
    tx.result_name === 'MAJORITY_DISAGREE' &&
    finalRound.result === 7 &&
    lastRound.consensus_round === 'Undetermined' &&
    lastChanges.at(-1) === 'UNDETERMINED' &&
    finalChanges.at(-1) === 'FINALIZED' &&
    tx.leader_only === false &&
    (tx.txExecutionResult === undefined || tx.txExecutionResult === 2) &&
    (tx.txExecutionResultName === undefined ||
      tx.txExecutionResultName === 'FINISHED_WITH_ERROR')
  ) {
    return {
      state: 'failed',
      label:
        'Finalized without validator agreement. The transaction did not complete successfully.',
    };
  }
  const outcomes: string[] = [];
  if (typeof tx.txExecutionResultName === 'string')
    outcomes.push(tx.txExecutionResultName);
  if (typeof tx.txExecutionResult === 'number')
    outcomes.push(
      ['NOT_VOTED', 'FINISHED_WITH_RETURN', 'FINISHED_WITH_ERROR'][
        tx.txExecutionResult
      ] ?? 'UNKNOWN',
    );
  const consensus = object(tx.consensus_data);
  if (tx.consensus_history !== undefined) {
    // If round evidence exists, conflicting/incomplete history must fail closed
    // even when some other execution-result field claims success.
    outcomes.push(studioFinalOutcome(tx) ?? 'UNKNOWN');
  }
  const leaders = Array.isArray(consensus.leader_receipt)
    ? consensus.leader_receipt
    : consensus.leader_receipt
      ? [consensus.leader_receipt]
      : [];
  // A simulator receipt must identify its final round. Never accept an old leader's success.
  if (consensus.final === true && leaders.length === 1) {
    const outcome = object(leaders[0]).execution_result;
    if (typeof outcome === 'string') outcomes.push(outcome);
  }
  if (
    outcomes.length &&
    outcomes.every((v) => v === 'FINISHED_WITH_RETURN' || v === 'SUCCESS')
  )
    return { state: 'success', label: 'Finalized; execution succeeded.' };
  if (
    outcomes.length &&
    outcomes.every((v) => v === 'FINISHED_WITH_ERROR' || v === 'ERROR')
  )
    return {
      state: 'failed',
      label:
        'Finalized, but contract execution failed. No completion was recorded by the app.',
    };
  return {
    state: 'unknown',
    label:
      'Finalized, but execution success is not proven. Keep this hash and check again.',
  };
}

function plain(value: unknown): unknown {
  if (value instanceof Map)
    return Object.fromEntries([...value].map(([key, v]) => [key, plain(v)]));
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'bigint')
    return Number.isSafeInteger(Number(value))
      ? Number(value)
      : value.toString();
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    );
  return value;
}
export async function verifyReceiptCall(
  input: unknown,
  expected: Pick<Pending, 'method' | 'callDigest'>,
): Promise<boolean> {
  try {
    const tx = object(input),
      decoded = object(tx.txDataDecoded),
      data = object(tx.data);
    if (
      tx.value !== 0 &&
      tx.value !== BigInt(0) &&
      tx.value !== '0' &&
      tx.value !== '0x0'
    )
      return false;
    if (
      decoded.leaderOnly === true ||
      data.leader_only === true ||
      tx.leader_only === true
    )
      return false;
    let call: unknown = decoded.callData;
    if (!call) {
      const raw = object(data.calldata).raw;
      const base64 =
        typeof data.calldata === 'string'
          ? data.calldata
          : object(data.calldata).base64;
      let bytes: Uint8Array;
      if (
        Array.isArray(raw) &&
        raw.length <= 30000 &&
        raw.every((v) => Number.isInteger(v) && v >= 0 && v <= 255)
      )
        bytes = Uint8Array.from(raw);
      else if (typeof base64 === 'string' && base64.length <= 40000)
        bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      else return false;
      const { abi } = await import('genlayer-js');
      call = abi.calldata.decode(bytes);
    }
    const value = object(plain(call));
    const args = value.args ?? [];
    if (value.method !== expected.method || !Array.isArray(args)) return false;
    if (
      value.kwargs !== undefined &&
      (!value.kwargs ||
        typeof value.kwargs !== 'object' ||
        Array.isArray(value.kwargs) ||
        Object.keys(value.kwargs).length)
    )
      return false;
    return (await digest([value.method, args])) === expected.callDigest;
  } catch {
    return false;
  }
}
