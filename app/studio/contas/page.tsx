'use client';
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Search, Plus, KeyRound, Pencil, X, Copy, Mail, Users, ShieldCheck, Trash2, CheckCircle2 } from 'lucide-react';
import ProfileEditor from '../../../components/profile-editor';
import './dashboard.css';

type Account = { id: string; username: string; displayName: string; email: string | null; role: string; createdAt: number };
type Mode = 'edit' | 'reset' | 'delete';
type Feedback = { text: string; error?: boolean } | null;

function Modal({ title, children, busy, onClose }: { title: string; children: ReactNode; busy: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { dialog?.close(); }; }, []);
  return <dialog ref={ref} className="accounts-dialog" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }} aria-labelledby="account-dialog-title">
    <header className="accounts-dialog-head"><h2 id="account-dialog-title">{title}</h2><button type="button" className="icon-button" aria-label="Fechar janela" disabled={busy} onClick={onClose}><X size={22}/></button></header>{children}
  </dialog>;
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [emailReady, setEmailReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [denied, setDenied] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<{ id: string; mode: Mode } | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [notice, setNotice] = useState('');
  const [link, setLink] = useState('');
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const target = accounts.find(a => a.id === selected?.id);

  async function load() {
    setLoading(true); setLoadError('');
    try {
      const r = await fetch('/api/admin/accounts', { cache: 'no-store' });
      if (r.status === 401 || r.status === 403) { setDenied(true); return; }
      const data = await r.json() as { accounts: Account[]; emailReady: boolean; error?: string };
      if (!r.ok) throw Error(data.error || 'Não foi possível carregar as contas.');
      setAccounts(data.accounts); setEmailReady(data.emailReady); setDenied(false);
    } catch (e) { setLoadError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  function open(account: Account, mode: Mode) {
    setSelected({ id: account.id, mode }); setFeedback(null); setNotice(''); setLink(''); setEmail(account.email || ''); setConfirmation(''); setIdentityConfirmed(false);
  }
  function close() { if (!busy) { setSelected(null); setCreating(false); setFeedback(null); setLink(''); } }
  async function request(body: Record<string, unknown>, method = 'POST') {
    const r = await fetch('/api/admin/accounts', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await r.json() as { message: string; link?: string; error?: string };
    if (!r.ok) throw Error(data.error || 'Não foi possível concluir. Tenta novamente.');
    return data as { message: string; link?: string };
  }
  async function act(action: 'email' | 'link' | 'send') {
    if (!target) return;
    setBusy(true); setFeedback(null);
    try {
      const data = await request({ action, accountId: target.id, ...(action === 'email' ? { email } : {}) });
      setFeedback({ text: data.message });
      if (data.link) setLink(data.link);
      if (action === 'email') await load();
    } catch (e) { setFeedback({ text: (e as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    try {
      const data = await request({ ...Object.fromEntries(new FormData(event.currentTarget)), action: 'create' });
      setCreating(false); setNotice(data.message); await load();
    } catch (e) { setFeedback({ text: (e as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  async function remove(event: FormEvent) {
    event.preventDefault(); if (!target) return;
    setBusy(true); setFeedback(null);
    try {
      const data = await request({ accountId: target.id, confirmation }, 'DELETE');
      setSelected(null); setNotice(data.message); await load();
    } catch (e) { setFeedback({ text: (e as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  const authors = accounts.filter(a => a.role !== 'admin');
  const missingEmail = authors.filter(a => !a.email).length;
  const term = query.trim().toLocaleLowerCase('pt');
  const visible = accounts.filter(a => (filter === 'all' || filter === 'authors' && a.role !== 'admin' || filter === 'missing' && a.role !== 'admin' && !a.email)
    && `${a.displayName} ${a.username} ${a.email || ''}`.toLocaleLowerCase('pt').includes(term));
  const feedbackElement = feedback && <p className={`account-feedback ${feedback.error ? 'is-error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>;

  if (denied) return <main className="accounts-dashboard accounts-gate"><ShieldCheck size={36}/><h1>Acesso reservado ao administrador</h1><p>Entra com a conta de administrador para gerir os utilizadores.</p><a className="account-button primary" href="/entrar">Entrar na conta</a></main>;

  return <main className="accounts-dashboard">
    <a className="accounts-back" href="/studio">Voltar ao estúdio editorial</a>
    <header className="accounts-heading"><div><span className="accounts-eyebrow">ADMINISTRAÇÃO DO LIVRO</span><h1>Contas e acesso</h1><p>Encontra um colega, atualiza os seus dados ou ajuda-o a recuperar a senha.</p></div><button className="account-button primary" disabled={busy || loading || !!loadError} onClick={() => { setCreating(true); setFeedback(null); }}><Plus size={19}/> Novo utilizador</button></header>
    {notice && <p className="account-feedback" role="status"><CheckCircle2 size={18}/>{notice}</p>}
    {loadError && <div className="account-feedback is-error" role="alert"><span>{loadError}</span><button onClick={() => void load()}>Tentar novamente</button></div>}
    <section className="accounts-summary" aria-label="Resumo de contas"><div><Users size={21}/><strong>{loading ? '…' : accounts.length}</strong><span>Contas no livro</span></div><div><Pencil size={21}/><strong>{loading ? '…' : authors.length}</strong><span>Autores</span></div><div><Mail size={21}/><strong>{loading ? '…' : missingEmail}</strong><span>Autores sem e-mail</span></div></section>
    <section className="accounts-directory" aria-label="Lista de utilizadores" aria-busy={loading}>
      <div className="accounts-search-row"><label className="accounts-search"><span>Procurar utilizador</span><div><Search size={19} aria-hidden="true"/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Nome, utilizador ou e-mail"/></div></label><label className="accounts-filter">Mostrar<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todas as contas</option><option value="authors">Apenas autores</option><option value="missing">Autores sem e-mail</option></select></label></div>
      <div className="accounts-list-heading"><h2>Utilizadores</h2><span>{loading ? 'A carregar…' : `${visible.length} de ${accounts.length} contas`}</span></div>
      {loading ? <p className="account-empty" role="status">A carregar os utilizadores…</p> : !loadError && visible.length === 0 ? <div className="account-empty"><Search size={28}/><h3>{accounts.length ? 'Nenhum utilizador encontrado' : 'Ainda não existem utilizadores'}</h3><p>{accounts.length ? 'Experimenta outro nome ou altera o filtro.' : 'Cria a primeira conta para começar.'}</p>{accounts.length > 0 && <button onClick={() => { setQuery(''); setFilter('all'); }}>Limpar pesquisa e filtros</button>}</div> : <div className="accounts-list">{!loadError && visible.map(a => <article className="account-row" key={a.id}>
        <div className="account-person"><div className="account-avatar" aria-hidden="true"><span>{a.displayName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('')}</span><img src={`/api/profile?photo=1&id=${encodeURIComponent(a.id)}`} alt="" onError={e => { e.currentTarget.style.display = 'none'; }}/></div><div><h3>{a.displayName}</h3><p>@{a.username} <span className={`account-role ${a.role === 'admin' ? 'admin' : ''}`}>{a.role === 'admin' ? 'Administrador' : 'Autor'}</span></p><p className={!a.email ? 'missing-email' : ''}>{a.email || 'E-mail por associar'}</p></div></div>
        <div className="account-row-actions"><button className="account-button" aria-label={`Editar dados de ${a.displayName}`} onClick={() => open(a, 'edit')}><Pencil size={17}/> Editar dados</button>{a.role !== 'admin' ? <button className="account-button primary" aria-label={`Repor senha de ${a.displayName}`} onClick={() => open(a, 'reset')}><KeyRound size={17}/> Repor senha</button> : <span className="account-protected"><ShieldCheck size={16}/> Conta protegida</span>}</div>
      </article>)}</div>}
    </section>

    {creating && <Modal title="Novo utilizador" busy={busy} onClose={close}><p className="dialog-intro">Cria uma conta de autor para um colega participar no livro.</p><form className="account-form" onSubmit={create}><fieldset disabled={busy}><label>Nome completo<input name="displayName" required minLength={3} maxLength={100} autoComplete="name"/></label><label>Nome de utilizador<input name="username" required pattern="[a-zA-Z0-9._-]{3,30}" autoComplete="off"/><small>3 a 30 caracteres: letras sem acentos, números, ponto, hífen ou sublinhado.</small></label><label>E-mail<input name="email" type="email" required maxLength={254} autoComplete="email"/></label><label>Senha inicial<input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/><small>Pelo menos 8 caracteres. Partilha a senha apenas com o titular.</small></label></fieldset>{feedbackElement}<footer className="dialog-actions"><button type="button" disabled={busy} onClick={close}>Cancelar</button><button className="account-button primary" disabled={busy}>{busy ? 'A criar conta…' : 'Criar conta de autor'}</button></footer></form></Modal>}

    {target && selected && <Modal title={selected.mode === 'reset' ? 'Repor senha' : selected.mode === 'delete' ? 'Eliminar conta' : 'Editar dados'} busy={busy} onClose={close}>
      <div className="dialog-person"><strong>{target.displayName}</strong><span>@{target.username}</span></div>
      {selected.mode === 'reset' && <><p className="dialog-intro">O colega vai escolher uma nova senha através de um link válido por <strong>30 minutos</strong>.</p><label className="identity-check"><input type="checkbox" checked={identityConfirmed} disabled={busy} onChange={e => setIdentityConfirmed(e.target.checked)}/><span>Confirmei a identidade do titular desta conta.</span></label>
        <section className="reset-option"><div><h3>Copiar e partilhar o link</h3><p>Envia-o diretamente ao colega pelo canal habitual. Não é necessário ter e-mail associado.</p></div><button className="account-button primary" disabled={busy || !identityConfirmed} onClick={() => void act('link')}><KeyRound size={18}/>{busy ? 'A processar…' : link ? 'Gerar novo link' : 'Gerar link de recuperação'}</button></section>
        {link && <div className="reset-result"><label>Link de recuperação para {target.displayName}<input readOnly value={link} onFocus={e => e.currentTarget.select()}/></label><button className="account-button primary" onClick={() => navigator.clipboard.writeText(link).then(() => setFeedback({ text: 'Link copiado. Partilha-o apenas com o titular.' })).catch(() => setFeedback({ text: 'Seleciona o link acima e copia-o manualmente.', error: true }))}><Copy size={18}/> Copiar link</button><small>Quem tiver este link poderá alterar a senha desta conta. Guarda-o em privado.</small></div>}
        <section className="reset-option email-option"><div><h3>Enviar por e-mail</h3><p>{!target.email ? 'Esta conta ainda não tem e-mail associado.' : !emailReady ? 'O envio automático por e-mail ainda não está disponível. Usa o link acima.' : `Enviar para ${target.email}`}</p></div><button className="account-button" disabled={busy || !identityConfirmed || !emailReady || !target.email} onClick={() => void act('send')}><Mail size={18}/> Enviar link por e-mail</button>{!target.email && <button className="text-button" disabled={busy} onClick={() => open(target, 'edit')}>Associar e-mail à conta</button>}</section>{feedbackElement}
      </>}
      {selected.mode === 'edit' && <><ProfileEditor accountId={target.id} initialName={target.displayName} onSaved={() => void load()}/>{target.role !== 'admin' && <><form className="account-form account-email-form" onSubmit={e => { e.preventDefault(); void act('email'); }}><h3>E-mail de contacto</h3><p>Usa o endereço do próprio titular para a recuperação de acesso.</p><label>E-mail<input type="email" required maxLength={254} value={email} disabled={busy} onChange={e => setEmail(e.target.value)}/></label><button className="account-button" disabled={busy}>{busy ? 'A guardar…' : 'Guardar e-mail'}</button></form>{feedbackElement}<details className="account-danger-zone"><summary>Eliminar esta conta</summary><p>A eliminação é permanente. Os testemunhos e as fotografias do livro serão preservados.</p><button className="account-button danger" disabled={busy} onClick={() => { setSelected({ id: target.id, mode: 'delete' }); setFeedback(null); setConfirmation(''); }}><Trash2 size={17}/> Continuar para eliminação</button></details></>}</>}
      {selected.mode === 'delete' && <form className="account-form" onSubmit={remove}><p className="dialog-intro">Esta ação remove o acesso, os dados de login e a foto de perfil. <strong>Os testemunhos e as fotografias enviados para o livro serão preservados.</strong></p><label>Escreve <strong>{target.username}</strong> para confirmar<input required autoComplete="off" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy}/></label>{feedbackElement}<footer className="dialog-actions"><button type="button" disabled={busy} onClick={() => open(target, 'edit')}>Voltar aos dados</button><button className="account-button danger" disabled={busy || confirmation !== target.username}>{busy ? 'A eliminar…' : 'Eliminar definitivamente'}</button></footer></form>}
    </Modal>}
  </main>;
}
