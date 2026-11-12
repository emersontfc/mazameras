import { currentAccount } from '../../../lib/account-auth';
import { getDb } from '../../../db';
import { entries, editorialPages } from '../../../db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function isEditor() {
  const user = await currentAccount();
  return user?.role === 'admin';
}

export async function GET() {
  if (!await isEditor()) return Response.json({ error: 'Acesso reservado ao editor.' }, { status: 403 });
  const db = getDb();
  const [contributions, pages] = await Promise.all([
    db.select({ id: entries.id, author: entries.author, chapter: entries.chapter, question: entries.question, answer: entries.answer, updatedAt: entries.updatedAt, userId: entries.userId }).from(entries).where(eq(entries.visibility, 'book')),
    db.select().from(editorialPages),
  ]);
  return Response.json({ contributions, pages });
}

export async function PUT(request: Request) {
  if (!await isEditor()) return Response.json({ error: 'Acesso reservado ao editor.' }, { status: 403 });
  let data: Record<string, unknown>;
  try { data = await request.json(); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }
  const key = String(data.key || '').trim();
  const title = String(data.title || '').trim().slice(0, 180);
  const body = String(data.body || '').slice(0, 80000);
  const category = String(data.category || '').trim();
  const status = String(data.status || 'draft');
  if (!/^(collective|individual|dedication|frontmatter):[a-zA-Z0-9_-]{1,150}$/.test(key) || !title || !['collective','individual','dedication','frontmatter'].includes(category) || !['draft','review','approved'].includes(status) || !key.startsWith(category + ':')) {
    return Response.json({ error: 'Dados editoriais inválidos.' }, { status: 400 });
  }
  const now = Date.now();
  await getDb().insert(editorialPages).values({ key, title, body, category, status, updatedAt: now }).onConflictDoUpdate({ target: editorialPages.key, set: { title, body, category, status, updatedAt: now } });
  return Response.json({ ok: true, updatedAt: now });
}
