import { expect, test } from 'bun:test';
import { shorten } from './fetch';

test('keeps short excerpts as they are', () => {
  expect(shorten('Ten people were quarantined.')).toBe('Ten people were quarantined.');
});

test('cuts long excerpts at a word boundary and marks the cut', () => {
  const text = `${'word '.repeat(55)}and 251 people were taken hostage`;
  expect(shorten(text)).toBe(`${'word '.repeat(55)}and…`);
});
