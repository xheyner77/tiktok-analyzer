import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'v1:';

function getKey() {
  const raw = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

export function protectTikTokToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const key = getKey();
  if (!key) return token;

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function revealTikTokToken(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith(PREFIX)) return value;

  const key = getKey();
  if (!key) return null;

  const [ivRaw, tagRaw, encryptedRaw] = value.slice(PREFIX.length).split('.');
  if (!ivRaw || !tagRaw || !encryptedRaw) return null;

  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
