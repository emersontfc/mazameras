import { env } from '../../../../server/environment';
import { currentAccount, digest, randomHex, passwordHash, adminUsername } from '../../../../lib/account-auth';
import { getDb } from '../../../../db';
import { accounts, accountEmails, passwordResets, sessions, avatars, loginAttempts } from '../../../../db/schema';
import { eq, desc } from 'drizzle-orm';
export const dynamic = 'force-dynamic';
export async function GET() {
  if ((await currentAccount())?.role !== 'admin') return Response.json({error:'Acesso reservado ao administrador.'},{status:403});
  const rows = await getDb().select({id:accounts.id,username:accounts.username,displayName:accounts.displayName,role:accounts.role,createdAt:accounts.createdAt,email:accountEmails.email}).from(accounts).leftJoin(accountEmails,eq(accountEmails.accountId,accounts.id)).orderBy(desc(accounts.createdAt));
  const config = env as unknown as {RESEND_API_KEY?:string;RECOVERY_FROM_EMAIL?:string};
  return Response.json({accounts:rows,emailReady:!!(config.RESEND_API_KEY && config.RECOVERY_FROM_EMAIL)},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
  if ((await currentAccount())?.role !== 'admin') return Response.json({error:'Acesso reservado ao administrador.'},{status:403});
  try {
    const input = await request.json() as {accountId:string;action:string;email?:string;username?:string;displayName?:string;password?:string};
    const db = getDb();
    if(input.action === 'create') {
      const username=(input.username||'').trim().toLowerCase(); const displayName=(input.displayName||'').trim();const email=(input.email||'').trim().toLowerCase();const password=input.password||'';
      if(!/^[a-z0-9._-]{3,30}$/.test(username)||username===adminUsername()||displayName.length<3||displayName.length>100||password.length<8||password.length>128||!/^\S+@\S+\.\S+$/.test(email)||email.length>254)return Response.json({error:'Verifica os dados: nome, utilizador sem espaços, e-mail e senha com 8 a 128 caracteres.'},{status:400});
      const id=crypto.randomUUID();const salt=randomHex();
      await db.batch([db.insert(accounts).values({id,username,displayName,salt,passwordHash:await passwordHash(password,salt),role:'author',createdAt:Date.now()}),db.insert(accountEmails).values({accountId:id,email})]);
      return Response.json({message:'Utilizador cadastrado. Já pode entrar com os dados definidos.'},{status:201});
    }
    const account = (await db.select().from(accounts).where(eq(accounts.id,input.accountId)).limit(1))[0];
    if (!account || account.role === 'admin') return Response.json({error:'Seleciona uma conta de autor.'},{status:400});
    if(input.action === 'email') {
      const email=(input.email || '').trim().toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return Response.json({error:'E-mail inválido.'},{status:400});
      await db.insert(accountEmails).values({accountId:account.id,email}).onConflictDoUpdate({target:accountEmails.accountId,set:{email}});
      return Response.json({message:'E-mail guardado.'});
    }
    if(input.action !== 'link' && input.action !== 'send') return Response.json({error:'Ação inválida.'},{status:400});
    const config = env as unknown as {RESEND_API_KEY?:string;RECOVERY_FROM_EMAIL?:string};
    const email=(await db.select().from(accountEmails).where(eq(accountEmails.accountId,account.id)).limit(1))[0]?.email;
    if(input.action === 'send' && (!email || !config.RESEND_API_KEY || !config.RECOVERY_FROM_EMAIL)) return Response.json({error:'É necessário associar o e-mail e configurar o serviço de envio.'},{status:400});
    const token=randomHex(32); const tokenHash=await digest(token);
    await db.insert(passwordResets).values({tokenHash,accountId:account.id,expiresAt:Date.now()+30*60000});
    const link=new URL('/entrar',request.url);link.hash='recuperar='+token;
    if(input.action === 'send') {
      const sent=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.RECOVERY_FROM_EMAIL,to:[email],subject:'Reposição de senha — A Vida dum Estudante de Medicina',text:`O administrador enviou-te um link para definir uma nova palavra-passe. Válido por 30 minutos:\n${link}\nSe não precisas, ignora esta mensagem.`})});
      if(!sent.ok) {await db.delete(passwordResets).where(eq(passwordResets.tokenHash,tokenHash));return Response.json({error:'Falha no envio. Tenta novamente mais tarde.'},{status:503});}
      return Response.json({message:'Link enviado por e-mail.'});
    }
    return Response.json({message:'Link válido por 30 minutos. Partilha apenas com o titular, depois de confirmar a sua identidade.',link:String(link)},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Não foi possível concluir. Verifica se o e-mail já pertence a outra conta.'},{status:400});}
}

export async function DELETE(request:Request) {
 const actor=await currentAccount();
 if(actor?.role!=='admin')return Response.json({error:'Acesso reservado ao administrador.'},{status:403});
 try{
 const input=await request.json() as {accountId?:string;confirmation?:string};const db=getDb();
 const account=(await db.select().from(accounts).where(eq(accounts.id,input.accountId||'')).limit(1))[0];
 if(!account)return Response.json({error:'Conta não encontrada.'},{status:404});
 if(account.role==='admin'||account.id===actor.id)return Response.json({error:'A conta de administrador está protegida contra eliminação.'},{status:400});
 if(input.confirmation!==account.username)return Response.json({error:'Escreve o nome de utilizador para confirmar.'},{status:400});
 const avatar=(await db.select().from(avatars).where(eq(avatars.accountId,account.id)).limit(1))[0];
 await db.batch([db.delete(sessions).where(eq(sessions.accountId,account.id)),db.delete(passwordResets).where(eq(passwordResets.accountId,account.id)),db.delete(accountEmails).where(eq(accountEmails.accountId,account.id)),db.delete(avatars).where(eq(avatars.accountId,account.id)),db.delete(loginAttempts).where(eq(loginAttempts.username,account.username)),db.delete(accounts).where(eq(accounts.id,account.id))]);
 if(avatar)await env.BUCKET?.delete(avatar.objectKey).catch(()=>{});
 return Response.json({message:'Conta eliminada. Os testemunhos e as fotografias do livro foram preservados.'});
 }catch{return Response.json({error:'Não foi possível eliminar a conta.'},{status:400});}
}
