import { draftProblem } from './core.ts';
export interface ReplyTool {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
export interface ReplyModelContext {
  registerTool(
    tool: ReplyTool,
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
export interface ReplyContext {
  workspaceId: string | null;
  referenceVersion: number | null;
  role: string;
  liveEnabled: boolean;
  question: string;
  draft: string;
}
export async function registerReplyTools(
  context: ReplyModelContext,
  read: () => ReplyContext,
  stage: (question: string, draft: string) => void,
  signal: AbortSignal,
) {
  await context.registerTool(
    {
      name: 'replycheck_read_context',
      title: 'Read ReplyCheck context',
      description:
        'Read the selected public workspace, reference version, role and whether the in-memory draft is empty. Does not return draft text or submit a transaction.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (
          !input ||
          typeof input !== 'object' ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw new Error('Expected an empty object.');
        const current = read();
        return {
          workspaceId: current.workspaceId,
          referenceVersion: current.referenceVersion,
          role: current.role,
          liveEnabled: current.liveEnabled,
          hasDraft: !!(current.question || current.draft),
        };
      },
    },
    { signal },
  );
  await context.registerTool(
    {
      name: 'replycheck_stage_draft',
      title: 'Stage a reply draft',
      description:
        'Put a question and reply in the visible editor for the user to review. Does not check, approve, send, publish, connect a wallet or sign anything. Existing draft content requires replaceExisting: true.',
      inputSchema: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          draft: { type: 'string' },
          replaceExisting: { type: 'boolean' },
        },
        required: ['question', 'draft'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new Error('Expected an object.');
        const value = input as Record<string, unknown>;
        if (
          Object.keys(value).some(
            (key) => !['question', 'draft', 'replaceExisting'].includes(key),
          ) ||
          typeof value.question !== 'string' ||
          typeof value.draft !== 'string' ||
          (value.replaceExisting !== undefined &&
            typeof value.replaceExisting !== 'boolean')
        )
          throw new Error('Invalid draft fields.');
        const problem = draftProblem(value.question, value.draft);
        if (problem) throw new Error(problem);
        const current = read();
        if (
          (current.question || current.draft) &&
          value.replaceExisting !== true
        )
          throw new Error(
            'A draft already exists. Ask the user before replacing it.',
          );
        stage(value.question, value.draft);
        return {
          status: 'draft_staged',
          transactionSubmitted: false,
          next: 'User reviews the draft and any public-data submission.',
        };
      },
    },
    { signal },
  );
}
