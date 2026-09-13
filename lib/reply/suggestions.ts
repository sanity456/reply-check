import type { Finding } from './types';

export function hasReferenceGap(finding: Finding): boolean {
  return (
    finding.verdict === 'UNSUPPORTED' &&
    finding.reason_code === 'NOT_IN_REFERENCES'
  );
}

/** A local editing aid, never a replacement for the immutable assessment. */
export function draftSuggestion(finding: Finding): string {
  if (hasReferenceGap(finding))
    return `The references do not confirm this claim: “${finding.text}”`;
  return finding.suggestion;
}

export function suggestedDraft(findings: Finding[]): string {
  const suggestions = findings.map(draftSuggestion);
  return suggestions.some(Boolean)
    ? findings
        .map((finding, index) => suggestions[index] || finding.text)
        .join(' ')
    : '';
}
