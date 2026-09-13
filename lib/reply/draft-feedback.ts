import { draftProblem } from './core.ts';

/** Field feedback only. The combined draftProblem remains the submission gate. */
export function draftFieldProblem(
  field: 'question' | 'reply',
  value: string,
): string | null {
  return field === 'question'
    ? draftProblem(value, 'Public reply.')
    : draftProblem('Question?', value);
}
