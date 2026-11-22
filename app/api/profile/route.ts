import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db';
import { accounts, avatars } from '../../../db/schema';
import { currentAccount } from '../../../lib/account-auth';
import { imageType, MAX_PHOTO_BYTES } from '../../../lib/photo-validation';
export const dynamic = 'force-dynamic';
export async function GET(request:Request) {
 const actor=await currentAccount();if(!actor)return Response.json({error:'Inicia sessão.'},{status:401});
 const id=new URL(request.url).searchParams.get('id')||actor.id;
 if(id!==actor.id && actor.role!=='admin')return new Response(null,{status:403});
 if(new URL(request.url).searchParams.has('photo')){
 const row=(await getDb().select().from(avatars).where(eq(avatars.accountId,id)).limit(1))[0];
 if(!row)return new Response(null,{status:404});const file=await env.BUCKET?.get(row.objectKey);if(!file)return new Response(null,{status:404});
 return new Response(file.body,{headers:{'Content-Type':row.contentType,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }
 const row=(await getDb().select({id:accounts.id,displayName:accounts.displayName,username:accounts.username}).from(accounts).where(eq(accounts.id,id)).limit(1))[0];
 return Response.json({account:row},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request){
 const actor=await currentAccount();if(!actor)return Response.json({error:'Inicia sessão.'},{status:401});
 try {
 if(Number(request.headers.get('content-length'))>MAX_PHOTO_BYTES+65536)return Response.json({error:'Usa uma foto até 5 MB.'},{status:413});
 const data=await request.formData();const id=String(data.get('accountId')||actor.id);
 if(id!==actor.id && actor.role!=='admin')return Response.json({error:'Sem permissão.'},{status:403});
 const db=getDb();if(!(await db.select({id:accounts.id}).from(accounts).where(eq(accounts.id,id)).limit(1)).length)return Response.json({error:'Conta não encontrada.'},{status:404});
 const name=String(data.get('displayName')||'').trim();if(name.length<3||name.length>100)return Response.json({error:'O nome deve ter entre 3 e 100 caracteres.'},{status:400});
 const file=data.get('file');
 if(file instanceof File && file.size){
 if(file.size>MAX_PHOTO_BYTES)return Response.json({error:'Usa uma foto até 5 MB.'},{status:400});
 const bytes=new Uint8Array(await file.arrayBuffer());const contentType=imageType(bytes);if(!contentType)return Response.json({error:'Usa JPEG, PNG ou WebP.'},{status:400});
 if(!env.BUCKET)return Response.json({error:'Envio de fotos indisponível.'},{status:503});
 const old=(await db.select().from(avatars).where(eq(avatars.accountId,id)).limit(1))[0];const objectKey=`avatars/${id}/${crypto.randomUUID()}`;
 await env.BUCKET.put(objectKey,bytes,{httpMetadata:{contentType}});
 try{await db.batch([db.insert(avatars).values({accountId:id,objectKey,contentType}).onConflictDoUpdate({target:avatars.accountId,set:{objectKey,contentType}}),db.update(accounts).set({displayName:name}).where(eq(accounts.id,id))]);}catch(e){await env.BUCKET.delete(objectKey);throw e;}
 if(old)await env.BUCKET.delete(old.objectKey).catch(()=>{});
 }else{await db.update(accounts).set({displayName:name}).where(eq(accounts.id,id));}
 return Response.json({message:'Perfil atualizado.'});
 }catch{return Response.json({error:'Não foi possível guardar o perfil.'},{status:400});}
}
