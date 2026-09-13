export type Address = `0x${string}`;
export type Role = 'visitor' | 'member' | 'editor' | 'reviewer' | 'owner';
export type Verdict =
  | 'MATCHES_REFERENCES'
  | 'NEEDS_CHANGES'
  | 'NOT_ENOUGH_INFORMATION';
export type SegmentVerdict =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'UNSUPPORTED'
  | 'NEUTRAL';
export interface Reference {
  id: string;
  title: string;
  body: string;
  url: string;
}
export interface Workspace {
  id: string;
  name: string;
  owner: Address;
  version: number;
  member_addresses: Address[];
  review_count: number;
  card_count: number;
  archived: boolean;
  created_at: string;
}
export interface Bundle {
  workspace_id: string;
  version: number;
  documents: Reference[];
  digest: string;
  published_by: Address;
  published_at: string;
}
export interface Finding {
  segment_id: number;
  text: string;
  verdict: SegmentVerdict;
  reason_code: string;
  reason: string;
  citations: { reference_id: string; quote: string }[];
  suggestion: string;
}
export interface Assessment {
  verdict: Verdict;
  question_status: string;
  summary: string;
  findings: Finding[];
}
export interface Review {
  id: string;
  workspace_id: string;
  protocol: string;
  author: Address;
  version: number;
  reference_digest: string;
  question: string;
  draft: string;
  request_digest: string;
  assessment: Assessment;
  recorded_at: string;
}
export interface AnswerCard {
  id: string;
  workspace_id: string;
  review_id: string;
  title: string;
  version: number;
  draft: string;
  question: string;
  approved_by: Address;
  approved_at: string;
  retired: boolean;
  status: 'APPROVED' | 'NEEDS_RECHECK' | 'RETIRED';
}
export type Argument = string | number | boolean;
export interface EffectCheck {
  method: string;
  args: Argument[];
  equals?: unknown;
  fields?: Record<string, unknown>;
}
export interface Operation {
  method: string;
  args: Argument[];
  title: string;
  workspace: string;
  details: string[];
  effect: EffectCheck;
  containsPublicText?: boolean;
}
export interface Pending {
  hash: Address;
  account: Address;
  contract: Address;
  chainId: number;
  method: string;
  title: string;
  workspace: string;
  effect: EffectCheck;
  startedAt: string;
  callDigest: string;
}
export type Recovery = Omit<Pending, 'hash'> & { hash?: Address };
export interface Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    handler: (...args: unknown[]) => void,
  ) => void;
}
