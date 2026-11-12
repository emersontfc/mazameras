'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Eye, EyeOff, Feather, LockKeyhole, UserRound } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, username, displayName, password }) });
      const result = await r.json().catch(() => ({ error: 'O servidor não respondeu corretamente. Tenta novamente dentro de instantes.' })) as { error?: string; account?: { role: string } };
      if (!r.ok) throw Error(result.error || 'Não foi possível continuar.');
      window.location.href = result.account?.role === 'admin' ? '/studio' : '/';
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro inesperado.'); setBusy(false); }
  }

  return <main className="login-shell"><div className="login-left"><a href="/" className="login-back"><ArrowLeft size={16}/> Voltar à página inicial</a><div className="login-story"><span className="login-star" aria-hidden="true">✧</span><div className="login-eyebrow">A VIDA DE UM ESTUDANTE DE MEDICINA · VOL. II</div><h1>Há histórias que<br/>só tu <em>podes contar.</em></h1><p>A tua voz faz parte deste livro. Entra para escrever, guardar as memórias e deixar a tua dedicatória.</p><div className="login-rule"/><span>UMA TURMA. MIL HISTÓRIAS. UM LEGADO.</span></div></div><div className="login-right"><a href="/" className="mobile-login-back"><ArrowLeft size={16}/> Voltar ao livro</a><div className="login-form-card"><div className="login-symbol"><BookOpen size={26}/></div><span className="login-section-label">BEM-VINDO AO NOSSO LIVRO</span><h2>{mode === 'login' ? 'Continua a tua história.' : 'A tua história começa aqui.'}</h2><p>{mode === 'login' ? 'Entra na tua conta para continuar de onde paraste.' : 'Cria uma conta para que as tuas páginas fiquem guardadas em teu nome.'}</p><div className="login-switch"><button className={mode === 'login' ? 'on' : ''} onClick={() => {setMode('login');setError('')}}>Entrar</button><button className={mode === 'register' ? 'on' : ''} onClick={() => {setMode('register');setError('')}}>Criar conta</button></div><form onSubmit={submit}>{mode === 'register' && <label>NOME COMPLETO<div className="login-input"><UserRound size={17}/><input autoComplete="name" required minLength={3} placeholder="Como queres aparecer no livro" value={displayName} onChange={e => setDisplayName(e.target.value)}/></div></label>}<label>NOME DE UTILIZADOR<div className="login-input"><UserRound size={17}/><input autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9._-]+" placeholder="Ex.: emersoncharles" value={username} onChange={e => setUsername(e.target.value)}/></div></label><label>PALAVRA-PASSE<div className="login-input"><LockKeyhole size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 8 : 1} required placeholder={mode === 'register' ? 'Pelo menos 8 caracteres' : 'A tua palavra-passe'} value={password} onChange={e => setPassword(e.target.value)}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{error && <div className="login-error" role="alert">{error}</div>}<button className="login-submit" disabled={busy} type="submit">{busy ? 'A verificar…' : mode === 'login' ? 'Entrar na minha conta' : 'Criar a minha conta'} <ArrowRight size={18}/></button></form><div className="login-note"><Feather size={17}/><span>O teu nome identifica a autoria dos testemunhos. A palavra-passe não será mostrada a outros participantes.</span></div></div></div></main>;
}
