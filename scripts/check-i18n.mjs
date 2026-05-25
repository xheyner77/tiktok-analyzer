import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const translationsPath = path.join(root, 'lib', 'i18n', 'translations.ts');
const source = fs.readFileSync(translationsPath, 'utf8');

function readConstObject(name) {
  const startToken = `export const ${name}`;
  const start = source.indexOf(startToken);
  if (start === -1) throw new Error(`Missing export: ${name}`);

  const afterStart = source.indexOf('=', start) + 1;
  const endToken = name === 'translations' ? '} as const;' : '};';
  const end = source.indexOf(endToken, afterStart);
  if (end === -1) throw new Error(`Unable to parse ${name}`);

  const literal = source.slice(afterStart, end + 1);
  return vm.runInNewContext(`(${literal})`, {});
}

function flattenKeys(value, prefix = '') {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key));
}

function valueAt(value, dottedKey) {
  return dottedKey.split('.').reduce((current, key) => current?.[key], value);
}

const translations = readConstObject('translations');
const phraseTranslations = readConstObject('phraseTranslations');
const frKeys = flattenKeys(translations.fr).sort();
const enKeys = flattenKeys(translations.en).sort();
const errors = [];

for (const key of frKeys) {
  if (!enKeys.includes(key)) errors.push(`Missing EN key: ${key}`);
}

for (const key of enKeys) {
  if (!frKeys.includes(key)) errors.push(`Missing FR key: ${key}`);
}

for (const lang of ['fr', 'en']) {
  for (const key of flattenKeys(translations[lang])) {
    const value = valueAt(translations[lang], key);
    if (typeof value !== 'string') errors.push(`${lang}.${key} is not a string`);
    if (typeof value === 'string' && !value.trim()) errors.push(`${lang}.${key} is empty`);
  }
}

for (const [fr, en] of Object.entries(phraseTranslations)) {
  if (!fr.trim()) errors.push('Empty FR phrase key in phraseTranslations');
  if (typeof en !== 'string' || !en.trim()) errors.push(`Empty EN phrase for: ${fr}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`i18n OK: ${frKeys.length} structured keys and ${Object.keys(phraseTranslations).length} phrase translations.`);
