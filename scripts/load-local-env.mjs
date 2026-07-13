import { readFileSync } from 'node:fs';

/** Charge .env.local sans écraser les variables déjà injectées par CI/Vercel. */
export function loadLocalEnv(path = '.env.local') {
  try {
    const content = readFileSync(path, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator < 1) continue;
      const name = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
      if (!process.env[name]) process.env[name] = value;
    }
  } catch {
    // En CI, les variables peuvent être injectées sans fichier local.
  }
}
