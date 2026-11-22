import { env } from '../server/environment';
import { cookies } from 'next/headers';
import { getDb } from '../db';
import { accounts, sessions } from '../db/schema';
import { eq, and, gt } from 'drizzle-orm';

const encoder = new TextEncoder();
const COOKIE = 'mazameras_session';
const MONTH = 30 * 24 * 60 * 60 * 1000;

export type Account = { id: string; username: string; displayName: string; role: string };

export function normalizeUsername(raw: string) { return raw.trim().toLowerCase(); }
export function adminUsername() { return ((env as unknown as { ADMIN_USERNAME?: string }).ADMIN_USERNAME || '').toLowerCase(); }
export function adminPassword() { return (env as unknown as { ADMIN_PASSWORD?: string }).ADMIN_PASSWORD || ''; }

function toHex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
export function randomHex(size = 16) { const bytes = new Uint8Array(size); crypto.getRandomValues(bytes); return toHex(bytes); }

export async function digest(input: string) { return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(input)))); }
export async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  // Cloudflare Workers currently caps WebCrypto PBKDF2 at 100,000 iterations.
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, key, 256);
  return toHex(new Uint8Array(bits));
}
export function equalHex(a: string, b: string) { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }

export async function currentAccount(): Promise<Account | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw || !/^[0-9a-f]{64}$/.test(raw)) return null;
  const tokenHash = await digest(raw);
  const records = await getDb().select({ id: accounts.id, username: accounts.username, displayName: accounts.displayName, role: accounts.role }).from(sessions).innerJoin(accounts, eq(sessions.accountId, accounts.id)).where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, Date.now()))).limit(1);
  return records[0] || null;
}

export async function issueSession(accountId: string) {
  const token = randomHex(32);
  await getDb().insert(sessions).values({ tokenHash: await digest(token), accountId, expiresAt: Date.now() + MONTH });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: MONTH / 1000 });
}
export async function endSession() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token && /^[0-9a-f]{64}$/.test(token)) await getDb().delete(sessions).where(eq(sessions.tokenHash, await digest(token)));
  jar.delete(COOKIE);
}
