#!/usr/bin/env bun

import { DEFAULT_LANGUAGE_CODE, isSupportedLanguageCode } from '../src/lib/languages';
import { runDailyPipeline } from '../src/lib/pipeline/daily';

if (!process.env.OPENROUTER_API_KEY) {
  console.error('OPENROUTER_API_KEY environment variable is required');
  process.exit(1);
}

console.log('Environment variables validated');

const args = process.argv.slice(2);
const languageArg = args.find(arg => arg.startsWith('--lang='));
const requestedLanguage = languageArg ? languageArg.split('=')[1] : DEFAULT_LANGUAGE_CODE;

if (!isSupportedLanguageCode(requestedLanguage)) {
  console.error(`Unsupported language: ${requestedLanguage}. Expected one of en, it, fr.`);
  process.exit(1);
}

console.log(`Running pipeline for language: ${requestedLanguage}`);

runDailyPipeline(requestedLanguage).then((result) => {
  if (!result.success) {
    console.warn(`Pipeline completed with unavailable output for ${requestedLanguage}.`);
    process.exit(0);
  }

  console.log('All operations completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error(`\n${'='.repeat(60)}`);
  console.error(`ERROR in daily news pipeline for ${requestedLanguage}:`);
  console.error(`${'='.repeat(60)}`);
  console.error(error);
  console.error('Stack trace:', (error as Error).stack);
  console.error('Pipeline failed:', error);
  process.exit(1);
});
