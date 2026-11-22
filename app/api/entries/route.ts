import { currentAccount } from '../../../lib/account-auth';
import { getDb } from '../../../db';
import { entries } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function writer() {
  const user = await currentAccount();
  if (!user) return null;
  return { id: user.id, email: '', name: user.displayName };
}

export async function GET() {
  const actor = await writer();
  if (!actor) return Response.json({ error: 'Inicia sessão para continuares.' }, { status: 401 });
  const records = await getDb().select().from(entries).where(eq(entries.userId, actor.id));
  return Response.json({ entries: records, user: { name: actor.name, email: actor.email } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const actor = await writer();
  if (!actor) return Response.json({ error: 'Inicia sessão para continuares.' }, { status: 401 });
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const chapter = String(data.chapter ?? '').trim().slice(0, 100);
  const question = String(data.question ?? '').trim().slice(0, 250);
  const answer = String(data.answer ?? '').trim().slice(0, 10000);
  const author = String(data.author ?? '').trim().slice(0, 100);
  const visibility = data.visibility === 'book' ? 'book' : 'private';
  if (!chapter || !question || !author || !answer || answer.length < 10) return Response.json({ error: 'Preenche o nome e uma resposta de pelo menos 10 caracteres.' }, { status: 400 });
  const db = getDb();
  const existing = await db.select().from(entries).where(and(eq(entries.userId, actor.id), eq(entries.question, question))).limit(1);
  const now = Date.now();
  if (existing.length) {
    await db.update(entries).set({ answer, author, chapter, visibility, updatedAt: now }).where(eq(entries.id, existing[0].id));
  } else {
    await db.insert(entries).values({ id: crypto.randomUUID(), userId: actor.id, email: actor.email, author, chapter, question, answer, visibility, createdAt: now, updatedAt: now });
  }
  return Response.json({ ok: true });
}
