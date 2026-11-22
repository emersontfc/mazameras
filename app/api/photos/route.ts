import { env } from '../../../server/environment';
import { eq, and } from 'drizzle-orm';
import { currentAccount } from '../../../lib/account-auth';
import { getDb } from '../../../db';
import { entries, photos } from '../../../db/schema';
import { imageType, MAX_PHOTO_BYTES, photoMetadata } from '../../../lib/photo-validation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const actor = await currentAccount();
  if (!actor) return Response.json({ error: 'Inicia sessão.' }, { status: 401 });
  const rows = await getDb().select().from(photos).where(eq(photos.userId, actor.id));
  return Response.json({ photos: rows.map(({ objectKey: _key, ...photo }) => photo) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request) {
  const actor = await currentAccount();
  if (!actor) return Response.json({ error: 'Inicia sessão.' }, { status: 401 });
  if (!env.BUCKET) return Response.json({ error: 'O envio de fotografias está temporariamente indisponível.' }, { status: 503 });
  if (Number(request.headers.get('content-length')) > MAX_PHOTO_BYTES + 65536) return Response.json({ error: 'A fotografia deve ter até 5 MB.' }, { status: 413 });
  let data: FormData;
  try { data = await request.formData(); } catch { return Response.json({ error: 'Envio inválido.' }, { status: 400 }); }
  const file = data.get('file');
  const question = String(data.get('question') ?? '');
  if (!(file instanceof File) || !file.size || file.size > MAX_PHOTO_BYTES) return Response.json({ error: 'Escolhe uma fotografia até 5 MB.' }, { status: 400 });
  let metadata;
  try { metadata = photoMetadata(data); } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
  const db = getDb();
  const entry = await db.select({ id: entries.id }).from(entries).where(and(eq(entries.userId, actor.id), eq(entries.question, question))).limit(1);
  if (!entry.length) return Response.json({ error: 'Guarda primeiro a resposta desta página.' }, { status: 400 });
  const existing = await db.select({ id: photos.id }).from(photos).where(and(eq(photos.userId, actor.id), eq(photos.question, question))).limit(1);
  if (existing.length) return Response.json({ error: 'Já existe uma fotografia nesta resposta. Remove-a para escolher outra.' }, { status: 409 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = imageType(bytes);
  if (!contentType) return Response.json({ error: 'Usa uma fotografia JPEG, PNG ou WebP.' }, { status: 400 });
  const id = crypto.randomUUID();
  const objectKey = `photos/${actor.id}/${id}`;
  await env.BUCKET.put(objectKey, bytes, { httpMetadata: { contentType } });
  try {
    await db.insert(photos).values({ id, userId: actor.id, question, objectKey, contentType, ...metadata, createdAt: Date.now() });
  } catch {
    await env.BUCKET.delete(objectKey);
    return Response.json({ error: 'Não foi possível guardar. Atualiza a página e tenta novamente.' }, { status: 409 });
  }
  return Response.json({ ok: true, id }, { status: 201 });
}
