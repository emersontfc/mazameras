import { env } from '../../../../server/environment';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../../../../db';
import { entries, photos } from '../../../../db/schema';
import { currentAccount } from '../../../../lib/account-auth';
import { photoMetadata } from '../../../../lib/photo-validation';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  const actor = await currentAccount();
  if (!actor) return new Response(null, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [photo] = await db.select().from(photos).where(eq(photos.id, id)).limit(1);
  if (!photo) return new Response(null, { status: 404 });
  if (photo.userId !== actor.id) {
    if (actor.role !== 'admin' || !photo.publicationConsent) return new Response(null, { status: 404 });
    const allowed = await db.select({ id: entries.id }).from(entries).where(and(eq(entries.userId, photo.userId), eq(entries.question, photo.question), eq(entries.visibility, 'book'))).limit(1);
    if (!allowed.length) return new Response(null, { status: 404 });
  }
  const object = await env.BUCKET?.get(photo.objectKey);
  if (!object) return new Response(null, { status: 404 });
  return new Response(object.body, { headers: { 'Content-Type': photo.contentType, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
}

export async function PUT(request: Request, context: Context) {
  const actor = await currentAccount();
  if (!actor) return Response.json({ error: 'Inicia sessão.' }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [photo] = await db.select().from(photos).where(and(eq(photos.id, id), eq(photos.userId, actor.id))).limit(1);
  if (!photo) return Response.json({ error: 'Fotografia não encontrada.' }, { status: 404 });
  try {
    const data = await request.formData();
    await db.update(photos).set(photoMetadata(data)).where(and(eq(photos.id, id), eq(photos.userId, actor.id)));
  } catch (e) { return Response.json({ error: (e as Error).message }, { status: 400 }); }
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: Context) {
  const actor = await currentAccount();
  if (!actor) return Response.json({ error: 'Inicia sessão.' }, { status: 401 });
  const { id } = await context.params;
  const db = getDb();
  const [photo] = await db.select().from(photos).where(and(eq(photos.id, id), eq(photos.userId, actor.id))).limit(1);
  if (!photo) return Response.json({ error: 'Fotografia não encontrada.' }, { status: 404 });
  // Revoke access before removing the object; a storage failure cannot expose it.
  await db.delete(photos).where(and(eq(photos.id, id), eq(photos.userId, actor.id)));
  await env.BUCKET?.delete(photo.objectKey);
  return Response.json({ ok: true });
}
