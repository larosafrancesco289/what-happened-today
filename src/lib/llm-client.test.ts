import { describe, expect, it } from 'bun:test';
import { recoverSummaryFromMalformedOutput, sanitizeGeneratedSummary } from './llm-client';

describe('generated summary cleanup', () => {
  it('removes trailing word count boilerplate from model output', () => {
    const summary = sanitizeGeneratedSummary('Paragraph one.\n\nParagraph two.\n(Word count: 234)');
    expect(summary).toBe('Paragraph one.\n\nParagraph two.');
  });

  it('recovers a usable summary from malformed JSON wrappers', () => {
    const recovered = recoverSummaryFromMalformedOutput(`{
  "summary": "Paragraph one with enough detail to count as a real news summary. Paragraph one continues with more context and concrete facts.\n\nParagraph two adds follow-up detail about what changed and what comes next for readers to watch. (Word count: 210)"
}`);

    expect(recovered).toBe(
      'Paragraph one with enough detail to count as a real news summary. Paragraph one continues with more context and concrete facts.\n\nParagraph two adds follow-up detail about what changed and what comes next for readers to watch.'
    );
  });
});
