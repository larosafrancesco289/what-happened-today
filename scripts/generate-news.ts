#!/usr/bin/env bun

import { DEFAULT_LANGUAGE_CODE, SUPPORTED_LANGUAGE_CODES, isSupportedLanguageCode, type LanguageCode } from '../src/lib/languages';
import { runDailyPipelineSafely } from '../src/lib/pipeline/daily';

if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

console.log('Environment variables validated');

const args = process.argv.slice(2);
const languageArg = args.find(arg => arg.startsWith('--lang='));
const requestedLanguage = languageArg ? languageArg.split('=')[1] : DEFAULT_LANGUAGE_CODE;

// "all" runs each language independently so one failure never discards the others.
const languages: LanguageCode[] = requestedLanguage === 'all'
  ? [...SUPPORTED_LANGUAGE_CODES]
  : isSupportedLanguageCode(requestedLanguage)
    ? [requestedLanguage]
    : (() => {
        console.error(`Unsupported language: ${requestedLanguage}. Expected one of ${SUPPORTED_LANGUAGE_CODES.join(', ')} or "all".`);
        process.exit(1);
      })();

console.log(`Running pipeline for: ${languages.join(', ')}`);

const results = [];
for (const language of languages) {
  results.push(await runDailyPipelineSafely(language));
}

const succeeded = results.filter(r => r.success).map(r => r.language);
const failed = results.filter(r => !r.success);

console.log(`\n${'='.repeat(60)}`);
console.log(`Pipeline summary: ${succeeded.length}/${results.length} languages succeeded`);
if (succeeded.length > 0) console.log(`  Succeeded: ${succeeded.join(', ')}`);
for (const result of failed) {
  console.error(`  Failed (${result.language}): ${result.error || 'unknown error'}`);
}
console.log(`${'='.repeat(60)}`);

// Exit non-zero only if every requested language failed, so partial success still publishes.
process.exit(succeeded.length > 0 ? 0 : 1);
