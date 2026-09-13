'use client';
import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { registerReplyTools } from '@/lib/reply/webmcp';
import type { ReplyContext, ReplyModelContext } from '@/lib/reply/webmcp';
export function useReplyTools(
  context: ReplyContext,
  stage: (question: string, draft: string) => void,
) {
  const current = useRef({ context, stage });
  useEffect(() => {
    current.current = { context, stage };
  }, [context, stage]);
  useEffect(() => {
    const model = (document as Document & { modelContext?: ReplyModelContext })
      .modelContext;
    if (!model?.registerTool) return;
    const controller = new AbortController();
    void registerReplyTools(
      model,
      () => current.current.context,
      (question, draft) =>
        flushSync(() => current.current.stage(question, draft)),
      controller.signal,
    ).catch(() => {
      // Optional agent support must never disable the human UI or log draft content.
      controller.abort();
    });
    return () => controller.abort();
  }, []);
}
