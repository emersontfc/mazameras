'use client';

import ResponsePhoto from '../components/response-photo';
import { chapters } from '../lib/book-chapters';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, ArrowRight, ArrowLeft, Feather, Heart, LockKeyhole, Check, Download, Menu, X, Quote, Sparkles, PenLine, GraduationCap } from 'lucide-react';



type Entry = { question: string; answer: string; author: string; visibility: string; updatedAt: number; chapter: string };

export default function Home() {
  const [chapterIndex, setChapterIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [answer, setAnswer] = useState('');
  const [consent, setConsent] = useState(true);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [userKey, setUserKey] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'local' | 'saving' | 'saved' | 'error'>('idle');
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const currentQuestionRef = useRef('');
  const [menu, setMenu] = useState(false);
  const [started, setStarted] = useState(false);
  const [view, setView] = useState<'write' | 'manuscript'>('write');

  const chapter = chapters[chapterIndex];
  const question = chapter.questions[questionIndex];
  currentQuestionRef.current = question;
  const saved = useMemo(() => entries.find(e => e.question === question), [entries, question]);
  const allQuestions = chapters.flatMap(c => c.questions);
  const completed = new Set(entries.map(e => e.question)).size;

  useEffect(() => {
    fetch('/api/entries').then(async r => {
      if (r.status === 401) { setSignedOut(true); return; }
      if (!r.ok) throw Error('Erro ao carregar');
      const data = await r.json() as { entries?: Entry[]; user?: { name?: string; email?: string } }; setEntries(data.entries || []); setName(data.entries?.[0]?.author || data.user?.name || '');
      fetch('/api/account').then(r=>r.json()).then(raw => { const a = raw as { account?: { id: string; role: string } }; if (a.account) { setUserKey(a.account.id); setIsAdmin(a.account.role === 'admin'); } });
    }).catch(() => setStatus('Não foi possível carregar as respostas. Tenta novamente.')).finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (loading || !userKey) return;
    const current = entries.find(e => e.question === question);
    let draft: { answer: string; consent: boolean; timestamp: number } | null = null;
    try { const raw = localStorage.getItem(draftKey(question)); if (raw) draft = JSON.parse(raw); } catch { /* storage may be unavailable */ }
    const useDraft = draft && draft.timestamp > (current?.updatedAt || 0);
    setAnswer(useDraft ? draft!.answer : current?.answer || '');
    setConsent(useDraft ? draft!.consent : current ? current.visibility === 'book' : true);
    setDirty(!!useDraft);
    setSaveState(useDraft ? 'local' : current ? 'saved' : 'idle');
    setStatus('');
  // A completed background save must not overwrite text currently being typed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, loading, userKey]);

  function draftKey(q: string) { return `vidas-que-curam:draft:${userKey}:${q}`; }
  function rememberDraft(text: string, allowed: boolean) {
    try { localStorage.setItem(draftKey(question), JSON.stringify({ answer: text, consent: allowed, timestamp: Date.now() })); } catch { /* server save remains available */ }
    setDirty(true); setSaveState('local');
  }

  function persist(q: string, chapterTitle: string, text: string, author: string, allowed: boolean, silent = false): Promise<boolean> {
    if (!author.trim() || text.trim().length < 10) return Promise.resolve(false);
    setSaveState('saving');
    const payload = JSON.stringify({ chapter: chapterTitle, question: q, answer: text, author, visibility: allowed ? 'book' : 'private' });
    const work = saveQueue.current.catch(() => {}).then(async () => {
      const r = await fetch('/api/entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      const data = await r.json() as { error?: string }; if (!r.ok) throw Error(data.error || 'Erro ao guardar');
      setEntries(old => [...old.filter(e => e.question !== q), { chapter: chapterTitle, question: q, answer: text, author, visibility: allowed ? 'book' : 'private', updatedAt: Date.now() }]);
      let stillLatest = true;
      try {
        const key = draftKey(q); const raw = localStorage.getItem(key);
        if (raw) {
          const draft = JSON.parse(raw);
          stillLatest = draft.answer === text && draft.consent === allowed;
          if (stillLatest) localStorage.removeItem(key);
        }
      } catch { /* safe to leave the local copy */ }
      if (q === currentQuestionRef.current && stillLatest) { setSaveState('saved'); setDirty(false); if (!silent) setStatus('Página guardada com sucesso.'); }
    });
    saveQueue.current = work;
    return work.then(() => true).catch(e => { if (q === currentQuestionRef.current) { setSaveState('error'); setStatus(`Não foi possível guardar online: ${e instanceof Error ? e.message : 'tenta novamente'}. O rascunho mantém-se neste dispositivo.`); } return false; });
  }

  useEffect(() => {
    if (!dirty || loading || !userKey || !name.trim() || answer.trim().length < 10) return;
    const timer = window.setTimeout(() => { void persist(question, chapter.title, answer, name, consent, true); }, 1300);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, consent, name, question, dirty, loading, userKey]);

  async function logout() { await fetch('/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }); window.location.reload(); }

  function navigate(c: number, q: number) { if (dirty && answer.trim().length >= 10 && name.trim()) void persist(question, chapter.title, answer, name, consent, true); currentQuestionRef.current = chapters[c].questions[q]; setChapterIndex(c); setQuestionIndex(q); setView('write'); setMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function next() { if (questionIndex + 1 < chapter.questions.length) navigate(chapterIndex, questionIndex + 1); else if (chapterIndex + 1 < chapters.length) navigate(chapterIndex + 1, 0); else setView('manuscript'); }
  function previous() { if (questionIndex > 0) navigate(chapterIndex, questionIndex - 1); else if (chapterIndex > 0) navigate(chapterIndex - 1, chapters[chapterIndex - 1].questions.length - 1); }

  async function save() {
    if (!name.trim() || answer.trim().length < 10) { setStatus('Escreve o teu nome e pelo menos uma frase com 10 caracteres.'); return; }
    await persist(question, chapter.title, answer, name, consent);
  }

  async function openPreview() {
    if (dirty) {
      if (!name.trim() || answer.trim().length < 10) { setStatus('Guarda a resposta com pelo menos 10 caracteres antes de abrir a prévia.'); return; }
      if (!await persist(question, chapter.title, answer, name, consent, true)) return;
    }
    await saveQueue.current.catch(() => {});
    window.location.assign('/preview');
  }

  function download() {
    const content = ['# A VIDA DUM ESTUDANTE DE MEDICINA — CONTRIBUIÇÃO', `Autor: ${name}`, '', ...chapters.flatMap(c => {
      const answers = c.questions.map(q => entries.find(e => e.question === q)).filter(Boolean) as Entry[];
      return answers.length ? [`## ${c.title}`, '', ...answers.flatMap(e => [`### ${e.question}`, '', e.answer, '', `Partilha no livro: ${e.visibility === 'book' ? 'Sim' : 'Não'}`, ''])] : [];
    })].join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `memorias-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'medicina'}.md`; a.click(); URL.revokeObjectURL(a.href);
  }

  return <div className="site-shell">
    <header className="site-header">
      <div className="brand" onClick={() => { setStarted(false); setView('write'); }} role="button" tabIndex={0}><span className="brand-mark"><BookOpen size={22}/></span><div><strong>A Vida dum Estudante de Medicina</strong><small>UM LIVRO ESCRITO POR NÓS</small></div></div>
      <nav className="desktop-nav"><button onClick={() => { setStarted(false); setView('write'); }}>O projeto</button><button onClick={() => { setStarted(true); setView('write'); }}>Escrever a minha história</button><button onClick={() => { setStarted(true); setView('manuscript'); }}>As minhas páginas</button>{isAdmin && <a href="/studio">Estúdio Editorial</a>}</nav>
      <div className="header-right">{!signedOut && <a className="account-link" href="/perfil">Meu perfil</a>}<span className="edition">EDIÇÃO DE GRADUAÇÃO · 2026</span>{signedOut ? <a className="account-link" href="/entrar">Entrar / Criar conta</a> : <button className="account-link" onClick={logout}>Sair</button>}<button className="mobile-menu" aria-label="Abrir menu" onClick={() => setMenu(!menu)}>{menu ? <X/> : <Menu/>}</button></div>
    </header>
    {menu && <nav className="mobile-nav" aria-label="Menu principal"><button onClick={() => {setStarted(false); setMenu(false)}}>O projeto</button><button onClick={() => {setStarted(true);setView('write');setMenu(false)}}>Escrever a minha história</button><button onClick={() => {setStarted(true);setView('manuscript');setMenu(false)}}>As minhas páginas</button>{isAdmin && <a href="/studio">Estúdio Editorial</a>}{signedOut ? <a href="/entrar">Entrar / Criar conta</a> : <button onClick={logout}>Terminar sessão</button>}</nav>}

    {!started ? <main>
      <section className="hero"><div className="hero-left"><div className="eyebrow"><span className="eyebrow-line"/> UMA HISTÓRIA QUE AINDA ESTÁ A SER ESCRITA</div><div className="hero-ornament" aria-hidden="true">✧</div><h1>A Vida dum<br/><em>Estudante de</em><br/>Medicina<span className="period">.</span></h1><p className="hero-lead">Os anos passaram. As noites foram longas. Mas as histórias que vivemos merecem ficar para sempre.</p><p className="hero-copy">Esta é a continuação do nosso livro. Não escrita por uma só pessoa, mas por todos aqueles que caminharam juntos até à bata branca.</p><button className="primary-button" onClick={() => setStarted(true)}>Escrever o meu capítulo <ArrowRight size={19}/></button><div className="hero-foot"><span><Feather size={17}/> 7 capítulos de memórias</span><span><Heart size={17}/> Um legado coletivo</span></div></div><div className="hero-right"><div className="book-stack"><div className="book-back"/><div className="book-cover"><div className="cover-top">MEMÓRIAS DE UMA GERAÇÃO</div><div className="cover-symbol">✺</div><div className="cover-title">A VIDA<br/>DUM<br/><i>ESTUDANTE</i><br/>DE MEDICINA</div><div className="cover-rule"/><div className="cover-bottom">VOLUME II <span>2026</span></div></div></div><span className="image-caption">AS NOSSAS HISTÓRIAS. O NOSSO LEGADO.</span></div></section>
      <section className="quote-band"><Quote size={26}/><p>Há histórias que não cabem num diploma.<br/><em>Mas merecem viver nas páginas de um livro.</em></p><span>— O NOSSO CONVITE À TURMA</span></section>
      <section className="how"><div className="section-kicker">COMO FUNCIONA</div><h2>Uma página de cada vez.<br/><em>Uma vida em cada história.</em></h2><div className="how-grid"><article><span>01</span><PenLine/><h3>Recorda</h3><p>Encontra perguntas que te levam de volta aos momentos mais marcantes do curso.</p></article><article><span>02</span><Heart/><h3>Escreve</h3><p>Responde com as tuas palavras. Guarda e volta a editar ao teu ritmo.</p></article><article><span>03</span><BookOpen/><h3>Deixa a tua marca</h3><p>Autoriza as respostas que queres incluir na edição coletiva do livro.</p></article></div></section>
      <section className="closing"><div className="closing-star">✳</div><p>Para os que entraram com sonhos<br/>e saem com histórias.</p><button onClick={() => setStarted(true)}>Começar a escrever <ArrowRight size={18}/></button></section>
    </main> : <main className="workspace"><div className="workspace-head"><span className="section-kicker">O NOSSO LIVRO · VOLUME II</span><div className="workspace-head-row"><h1>{view === 'write' ? 'A tua história começa aqui.' : 'As tuas páginas.'}</h1><a className="personal-preview-link" href="/preview" onClick={e => { e.preventDefault(); void openPreview(); }}>Prévia do meu livro</a><div className="progress-wrap"><span>{completed} de {allQuestions.length} páginas respondidas</span><div className="progress-track"><div style={{width: `${completed / allQuestions.length * 100}%`}}/></div></div></div></div>
      <div className="workspace-grid"><aside className="chapter-sidebar"><div className="sidebar-heading">ÍNDICE DE CAPÍTULOS</div>{chapters.map((c,i) => <button key={c.id} className={`chapter-link ${chapterIndex === i && view === 'write' ? 'active' : ''}`} onClick={() => navigate(i, 0)}><span>{c.number}</span><span>{c.title}</span><small>{c.questions.filter(q => entries.some(e => e.question === q)).length}/{c.questions.length}</small></button>)}<button className={`chapter-link manuscript-link ${view === 'manuscript' ? 'active' : ''}`} onClick={() => setView('manuscript')}><BookOpen size={17}/><span>As minhas páginas</span></button><div className="sidebar-note"><Feather size={22}/><p>Não precisas de responder a tudo hoje. Cada memória tem o seu tempo.</p></div></aside>
      {view === 'write' ? <section className="writing-card"><div className="page-meta"><span>CAPÍTULO {chapter.number} / {chapters.length.toString().padStart(2,'0')}</span><span>PERGUNTA {String(questionIndex + 1).padStart(2,'0')} / {String(chapter.questions.length).padStart(2,'0')}</span></div><div className="page-rule"/><div className="chapter-kicker">{chapter.kicker}</div><h2>{chapter.title}</h2><div className="question-number">{String(questionIndex + 1).padStart(2,'0')}</div><h3>{question}</h3><label className="input-label" htmlFor="author">ASSINATURA NO LIVRO</label><input id="author" value={name} onChange={e => setName(e.target.value)} placeholder="O teu nome completo" maxLength={100}/><label className="input-label" htmlFor="answer">A TUA HISTÓRIA</label><textarea id="answer" value={answer} onChange={e => { setAnswer(e.target.value); rememberDraft(e.target.value, consent); setStatus(''); }} placeholder="Fecha os olhos por um instante. Regressa a esse momento. O que aconteceu? O que sentiste? Quem estava contigo? Escreve sem pressa…" rows={9} maxLength={10000}/><div className="writing-tip"><Sparkles size={17}/><span>Escreve de forma genuína, com detalhes e emoções. A organização editorial poderá ser melhorada mais tarde, preservando a tua voz.</span></div><label className="consent"><input type="checkbox" checked={consent} onChange={e => { setConsent(e.target.checked); rememberDraft(answer, e.target.checked); }}/><span>Autorizo que esta resposta seja considerada para o livro coletivo. { !consent && <strong>(Só eu poderei vê-la nesta fase.)</strong>}</span></label><ResponsePhoto key={question} question={question} saved={!!saved}/><div className="writing-actions"><button className="secondary-button" onClick={previous} disabled={chapterIndex === 0 && questionIndex === 0}><ArrowLeft size={17}/> Anterior</button><button className="save-button" onClick={save}><Check size={18}/> {saved ? 'Atualizar página' : 'Guardar página'}</button><button className="secondary-button" onClick={next}>Seguinte <ArrowRight size={17}/></button></div><div className={`autosave-status ${saveState}`} role="status">{saveState === 'saving' ? '● A guardar automaticamente…' : saveState === 'saved' ? '✓ Todas as alterações guardadas online' : saveState === 'local' ? '● Rascunho protegido neste dispositivo · Gravação online em breve' : saveState === 'error' ? '⚠ Falha na gravação online · Rascunho local preservado' : 'Escreve à vontade — a gravação é automática.'}</div>{status && <div className="save-status" role="status">{status}</div>}<div className="page-footer"><span>A Vida dum Estudante de Medicina</span><span>{String(allQuestions.indexOf(question) + 1).padStart(2, '0')}</span></div></section> : <section className="writing-card manuscript"><div className="page-meta"><span>MANUSCRITO PESSOAL</span><span>{completed} PÁGINAS</span></div><div className="page-rule"/><h2>As palavras que já deixaste.</h2><p className="manuscript-intro">Aqui estão todas as tuas respostas. Podes regressar a qualquer uma para corrigir ou acrescentar memórias.</p>{entries.length === 0 ? <div className="empty"><BookOpen size={40}/><p>Ainda não escreveste nenhuma página.</p><button className="primary-button" onClick={() => navigate(0,0)}>Começar agora <ArrowRight size={17}/></button></div> : chapters.map((c,ci) => {const list = c.questions.map((q,qi) => ({q,qi,e: entries.find(e => e.question === q)})).filter(item => item.e);return list.length ? <div className="manuscript-section" key={c.id}><div className="manuscript-heading">{c.number} — {c.title}</div>{list.map(item => <button key={item.q} onClick={() => navigate(ci,item.qi)}><strong>{item.q}</strong><span>{item.e?.answer.slice(0,150)}{(item.e?.answer.length || 0) > 150 ? '…' : ''}</span><small>{item.e?.visibility === 'book' ? '✓ Autorizado para o livro' : 'Privado'} · Editar página →</small></button>)}</div> : null})}<a className="personal-preview-link" href="/preview" onClick={e => { e.preventDefault(); void openPreview(); }}>Ver as minhas páginas no livro →</a><button className="download-button" onClick={download}><Download size={18}/> Descarregar as minhas respostas (.md)</button></section>}
      <aside className="editorial-aside"><div className="aside-icon"><GraduationCap size={25}/></div><h3>Uma memória de cada vez</h3><p>A tua contribuição é única. Não precisas de escrever como um autor profissional — precisamos da tua verdade.</p><div className="aside-divider"/><div className="privacy-note"><LockKeyhole size={16}/><span>As respostas ficam guardadas na tua conta. A inclusão no livro depende da autorização que assinalares.</span></div><div className="aside-quote">“Um dia, voltaremos a estas páginas e reconheceremos quem fomos.”</div></aside></div></main>}
    <footer className="footer"><span>✳ A Vida dum Estudante de Medicina</span><span>Feito para preservar o que vivemos. © 2026</span><span>UM LEGADO DA NOSSA TURMA</span></footer>
    {signedOut && started && <div className="auth-overlay"><div className="auth-box"><BookOpen size={36}/><h2>O teu capítulo espera por ti.</h2><p>Cria uma conta gratuita ou entra com o teu nome de utilizador. Assim, as tuas memórias ficam associadas a ti e podes continuar noutro dispositivo.</p><a href="/entrar">Entrar ou criar conta <ArrowRight size={17}/></a><button className="auth-back" onClick={() => setStarted(false)}>Voltar à apresentação</button></div></div>}
    {loading && <div className="loading-bar"/>}
  </div>;
}
