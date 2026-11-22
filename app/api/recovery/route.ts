import { env } from '../../../server/environment';
import { getDb } from '../../../db';
import { accounts, accountEmails, passwordResets, sessions, loginAttempts } from '../../../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { digest, randomHex, passwordHash } from '../../../lib/account-auth';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  try {
    const input = await request.json() as Record<string,string>;
    const db = getDb(); const now = Date.now();
    if (input.action === 'reset') {
      if (!/^[a-f0-9]{64}$/.test(input.token || '') || !input.password || input.password.length < 8 || input.password.length > 128) return Response.json({error:'Indica uma palavra-passe entre 8 e 128 caracteres e um link válido.'},{status:400});
      const hash = await digest(input.token);
      const reset = (await db.select().from(passwordResets).where(and(eq(passwordResets.tokenHash,hash),gt(passwordResets.expiresAt,now))).limit(1))[0];
      if (!reset) return Response.json({error:'O link expirou ou já foi utilizado. Pede um novo.'},{status:400});
      const salt = randomHex(); const password = await passwordHash(input.password,salt);
      // Claim the token exactly once before changing credentials.
      const claimed = await db.delete(passwordResets).where(and(eq(passwordResets.tokenHash,hash),gt(passwordResets.expiresAt,Date.now()))).returning();
      if (!claimed.length) return Response.json({error:'Este link já foi utilizado.'},{status:400});
      await db.batch([db.update(accounts).set({salt,passwordHash:password}).where(eq(accounts.id,reset.accountId)), db.delete(sessions).where(eq(sessions.accountId,reset.accountId)), db.delete(passwordResets).where(eq(passwordResets.accountId,reset.accountId))]);
      return Response.json({message:'Palavra-passe alterada. Já podes entrar.'});
    }
    const config = env as unknown as {RESEND_API_KEY?:string; RECOVERY_FROM_EMAIL?:string};
    if (!config.RESEND_API_KEY || !config.RECOVERY_FROM_EMAIL) return Response.json({error:'O envio de recuperação por e-mail está a ser configurado. Contacta o organizador para recuperar o acesso.'},{status:503});
    const email = (input.email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return Response.json({error:'Indica um e-mail válido.'},{status:400});
    const key = 'reset:' + await digest(email);
    const attempt = (await db.select().from(loginAttempts).where(eq(loginAttempts.username,key)).limit(1))[0];
    if (attempt && now-attempt.lastAttempt < 60000) return Response.json({error:'Espera um minuto antes de pedir outro link.'},{status:429});
    await db.insert(loginAttempts).values({username:key,count:1,lastAttempt:now}).onConflictDoUpdate({target:loginAttempts.username,set:{lastAttempt:now}});
    const found = (await db.select({id:accounts.id,role:accounts.role}).from(accountEmails).innerJoin(accounts,eq(accountEmails.accountId,accounts.id)).where(eq(accountEmails.email,email)).limit(1))[0];
    if (found && found.role !== 'admin') {
      const token = randomHex(32); const tokenHash = await digest(token);
      await db.insert(passwordResets).values({tokenHash,accountId:found.id,expiresAt:now+30*60000});
      const link = new URL('/entrar',request.url); link.hash = 'recuperar=' + token;
      const sent = await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${config.RESEND_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({from:config.RECOVERY_FROM_EMAIL,to:[email],subject:'Recuperar acesso — A Vida dum Estudante de Medicina',text:`Para definir uma nova palavra-passe, abre este link (válido por 30 minutos):\n${link}\nSe não pediste esta alteração, ignora esta mensagem.`})});
      if (!sent.ok) {await db.delete(passwordResets).where(eq(passwordResets.tokenHash,tokenHash));return Response.json({error:'Não foi possível enviar o e-mail. Tenta novamente mais tarde.'},{status:503});}
    }
    return Response.json({message:'Se o e-mail estiver associado a uma conta, receberás um link. Verifica também o spam. Contas antigas sem e-mail associado precisam da ajuda do organizador.'});
  } catch { return Response.json({error:'Não foi possível concluir. Tenta novamente dentro de instantes.'},{status:503}); }
}
