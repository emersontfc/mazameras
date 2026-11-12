'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Check, ChevronRight, ClipboardList, Download, Feather, FileText, Heart, LibraryBig, LockKeyhole, PenTool, Printer, Quote, RefreshCw, Save, Search, Sparkles, Users } from 'lucide-react';

type Contribution = { id: string; userId: string; author: string; chapter: string; question: string; answer: string; updatedAt: number };
type Page = { key: string; title: string; category: string; body: string; status: 'draft' | 'review' | 'approved'; updatedAt: number };
const sections = [
  { id: 'origens', title: 'Antes da bata branca', match: 'Antes da bata branca' },
  { id: 'primeiros', title: 'Os nossos primeiros passos', match: 'Os nossos primeiros passos' },
  { id: 'tempestades', title: 'Quando quase desistimos', match: 'Quando quase desistimos' },
  { id: 'pessoas', title: 'As pessoas que nos sustentaram', match: 'As pessoas que nos sustentaram' },
  { id: 'hospital', title: 'O hospital ensinou-nos', match: 'O hospital ensinou-nos' },
  { id: 'legado', title: 'O que levamos connosco', match: 'O que levamos connosco' },
];

export default function Studio() {
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'collective' | 'individual' | 'dedication'>('collective');
  const [selectedKey, setSelectedKey] = useState('collective:origens');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'draft' | 'review' | 'approved'>('draft');
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [query, setQuery] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch('/api/editorial', { cache: 'no-store' });
      if (r.status === 403) { setDenied(true); return; }
      if (!r.ok) throw Error('Não foi possível carregar o estúdio.');
      const data = await r.json() as { contributions: Contribution[]; pages: Page[] };
      setContributions(data.contributions); setPages(data.pages); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Erro ao carregar.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const authors = useMemo(() => {
    const m = new Map<string, { userId: string; name: string; count: number }>();
    for (const c of contributions) { const old = m.get(c.userId); if (!old) m.set(c.userId, { userId: c.userId, name: c.author, count: 1 }); else old.count++; }
    return [...m.values()].sort((a,b) => a.name.localeCompare(b.name, 'pt'));
  }, [contributions]);
  const items = useMemo(() => mode === 'collective'
    ? sections.map(c => ({ key: `collective:${c.id}`, title: c.title, count: contributions.filter(a => a.chapter === c.match).length }))
    : authors.map(a => ({ key: `${mode}:${a.userId}`, title: a.name, count: contributions.filter(c => c.userId === a.userId && (mode === 'dedication' ? c.chapter === 'Cartas para guardar' : c.chapter !== 'Cartas para guardar')).length })),
  [mode, authors, contributions]);

  const active = items.find(i => i.key === selectedKey) || items[0];
  const stored = pages.find(p => p.key === active?.key);
  const sources = useMemo(() => {
    if (!active) return [];
    let list = contributions;
    if (mode === 'collective') { const section = sections.find(s => `collective:${s.id}` === active.key); list = list.filter(c => c.chapter === section?.match); }
    else { const userId = active.key.slice(mode.length + 1); list = list.filter(c => c.userId === userId && (mode === 'dedication' ? c.chapter === 'Cartas para guardar' : c.chapter !== 'Cartas para guardar')); }
    const term = query.toLocaleLowerCase('pt');
    return list.filter(c => !term || `${c.author} ${c.question} ${c.answer}`.toLocaleLowerCase('pt').includes(term));
  }, [contributions, active, mode, query]);
  useEffect(() => { setText(stored?.body || ''); setStatus(stored?.status || 'draft'); setDirty(false); setSaveStatus(''); setSelectedSources([]); setQuery(''); }, [active?.key, stored?.updatedAt]);

  function switchMode(next: 'collective' | 'individual' | 'dedication') {
    if (dirty && !confirm('Tens alterações não guardadas. Queres mudar de secção e descartá-las?')) return;
    setMode(next);
    const key = next === 'collective' ? 'collective:origens' : authors.length ? `${next}:${authors[0].userId}` : '';
    setSelectedKey(key); setShowPreview(false);
  }
  function choose(key: string) {
    if (dirty && !confirm('Tens alterações não guardadas. Queres mudar de página e descartá-las?')) return;
    setSelectedKey(key); setShowPreview(false);
  }
  function insert(source: Contribution) {
    const quote = `**${source.author} — ${source.question}**\n\n“${source.answer.trim()}”`;
    setText(old => old ? `${old.trim()}\n\n${quote}` : quote); setDirty(true);
  }
  function assemble() {
    const selected = sources.filter(s => selectedSources.includes(s.id));
    if (!selected.length) return;
    const intro = mode === 'collective' ? `# ${active?.title}\n\n[Introdução editorial — escrever aqui uma abertura fiel aos testemunhos.]` : `# ${active?.title}\n\n[Retrato pessoal — editar e articular os testemunhos sem alterar os factos.]`;
    const body = selected.map(s => `### ${s.question}\n\n“${s.answer.trim()}”\n\n— ${s.author}`).join('\n\n');
    setText(old => [old.trim() || intro, body].filter(Boolean).join('\n\n')); setDirty(true);
  }
  async function save() {
    if (!active) return;
    setSaveStatus('A guardar…');
    try {
      const r = await fetch('/api/editorial', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: active.key, title: active.title, category: mode, body: text, status }) });
      const data = await r.json() as { error?: string; updatedAt?: number };
      if (!r.ok) throw Error(data.error || 'Falha na gravação.');
      setPages(old => [...old.filter(p => p.key !== active.key), { key: active.key, title: active.title, body: text, category: mode, status, updatedAt: data.updatedAt || Date.now() }]);
      setDirty(false); setSaveStatus('✓ Página editorial guardada.');
    } catch(e) { setSaveStatus(e instanceof Error ? e.message : 'Erro ao guardar.'); }
  }
  function manuscript() {
    return [
      '# A VIDA DE UM ESTUDANTE DE MEDICINA — VOLUME II',
      '## Vidas que Curam', '',
      '### PRIMEIRA PARTE · A NOSSA HISTÓRIA',
      ...sections.map(s => pages.find(p => p.key === `collective:${s.id}`)).filter(Boolean).map(p => `\n## ${p!.title}\n\n${p!.body}\n\n_Estado editorial: ${p!.status}_`),
      '\n### SEGUNDA PARTE · AS NOSSAS VOZES',
      ...authors.map(a => pages.find(p => p.key === `individual:${a.userId}`)).filter(Boolean).map(p => `\n## ${p!.title}\n\n${p!.body}`),
      '\n### TERCEIRA PARTE · CARTAS PARA GUARDAR',
      ...authors.map(a => pages.find(p => p.key === `dedication:${a.userId}`)).filter(Boolean).map(p => `\n## ${p!.title}\n\n${p!.body}`),
    ].join('\n');
  }
  function download() {
    const blob = new Blob([manuscript()], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'vidas-que-curam-volume-ii-manuscrito.md'; a.click(); URL.revokeObjectURL(url);
  }

  if (denied) return <div className="studio-gate"><LockKeyhole size={38}/><h1>Área editorial reservada</h1><p>Este espaço é exclusivo do administrador do livro. Entra com a conta de administrador para continuar.</p><a href="/entrar">Entrar como administrador</a><a href="/">Voltar ao livro</a></div>;
  if (loading) return <div className="studio-gate"><BookOpen size={38}/><h1>A abrir o estúdio…</h1></div>;
  if (error) return <div className="studio-gate"><h1>Não foi possível abrir o estúdio.</h1><p>{error}</p><button onClick={refresh}>Tentar novamente</button></div>;

  return <div className="studio-shell">
    <header className="studio-top"><a href="/" className="studio-back"><ArrowLeft size={17}/> Voltar ao livro</a><div className="studio-brand"><span>✳</span><div><strong>ESTÚDIO EDITORIAL</strong><small>VIDAS QUE CURAM · VOLUME II</small></div></div><div className="studio-top-actions"><button onClick={() => setShowPreview(true)}><BookOpen size={16}/> Pré-visualizar livro</button><button className="studio-export" onClick={download}><Download size={16}/> Exportar manuscrito</button></div></header>
    <div className="studio-heading"><div><span className="studio-kicker">O TEU ESPAÇO DE CRIAÇÃO</span><h1>Das memórias ao <em>livro.</em></h1><p>Organiza, revê e transforma testemunhos autorizados num legado para a turma.</p></div><div className="studio-stats"><div><strong>{authors.length}</strong><span>Autores</span></div><div><strong>{contributions.length}</strong><span>Respostas autorizadas</span></div><div><strong>{pages.filter(p => p.status === 'approved').length}</strong><span>Páginas aprovadas</span></div></div></div>
    <div className="studio-tabs"><button className={mode === 'collective' ? 'on' : ''} onClick={() => switchMode('collective')}><LibraryBig size={18}/> Narrativa coletiva</button><button className={mode === 'individual' ? 'on' : ''} onClick={() => switchMode('individual')}><Users size={18}/> Páginas individuais</button><button className={mode === 'dedication' ? 'on' : ''} onClick={() => switchMode('dedication')}><Heart size={18}/> Dedicatórias</button></div>
    <div className="studio-grid">
      <aside className="studio-index"><div className="studio-label">{mode === 'collective' ? 'CAPÍTULOS DO LIVRO' : 'AUTORES'}</div>{items.length ? items.map((item,i) => <button key={item.key} className={active?.key === item.key ? 'active' : ''} onClick={() => choose(item.key)}><span className="index-num">{String(i + 1).padStart(2,'0')}</span><span className="index-main">{item.title}<small>{item.count} testemunhos · {pages.some(p => p.key === item.key) ? 'Rascunho iniciado' : 'Por começar'}</small></span><ChevronRight size={15}/></button>) : <p className="no-sources">Ainda não há respostas autorizadas nesta secção.</p>}<div className="studio-hint"><Feather size={21}/><p>As respostas originais nunca são alteradas no Estúdio Editorial.</p></div></aside>
      <section className="studio-editor">{active ? <><div className="editor-topline"><span><PenTool size={14}/> PÁGINA EDITORIAL</span><span>{dirty ? '● Alterações não guardadas' : stored ? '✓ Guardada' : 'Nova página'}</span></div><h2>{active.title}</h2><p className="editor-instruction">{mode === 'collective' ? 'Constrói a história coletiva deste capítulo, ligando experiências dos diferentes colegas.' : mode === 'individual' ? 'Cria uma página biográfica e narrativa para este colega, preservando a sua voz.' : 'Organiza as cartas e dedicatórias deste colega com cuidado e respeito.'}</p><div className="editor-toolbar"><label>ESTADO EDITORIAL <select value={status} onChange={e => {setStatus(e.target.value as Page['status']);setDirty(true)}}><option value="draft">Rascunho</option><option value="review">Em revisão</option><option value="approved">Aprovado</option></select></label><span>{text.length.toLocaleString('pt-PT')} caracteres</span></div><textarea className="manuscript-textarea" value={text} onChange={e => {setText(e.target.value);setDirty(true)}} placeholder="Começa com uma abertura cativante ou seleciona testemunhos à direita para construir esta página.\n\nCada voz merece ser fielmente representada…"/><div className="editor-bottom"><span className="save-feedback" role="status">{saveStatus || 'As mudanças editoriais são guardadas quando clicas em Guardar.'}</span><button className="studio-save" onClick={save}><Save size={17}/> Guardar página</button></div><div className="editor-caution"><Sparkles size={17}/><p><strong>Preparado para edição com IA.</strong> A futura ferramenta poderá sugerir transições e melhorar o estilo, sempre com comparação do original e aprovação humana. Nesta versão, a composição é manual e verificável.</p></div></> : <div className="empty-editor"><FileText size={35}/><h2>À espera de histórias</h2><p>Quando os colegas contribuírem e autorizarem o uso das respostas, as páginas aparecerão aqui.</p></div>}</section>
      <aside className="studio-sources"><div className="sources-head"><div><span className="studio-label">MATÉRIA-PRIMA DO LIVRO</span><h3>Testemunhos</h3></div><span>{sources.length}</span></div><label className="source-search"><Search size={16}/><input placeholder="Procurar nas histórias…" value={query} onChange={e => setQuery(e.target.value)}/></label><p className="sources-explain">Apenas respostas que os colegas autorizaram para o livro.</p><div className="source-list">{sources.length ? sources.map(s => <article key={s.id}><label className="source-check"><input type="checkbox" checked={selectedSources.includes(s.id)} onChange={e => setSelectedSources(old => e.target.checked ? [...old,s.id] : old.filter(id => id !== s.id))}/><span>{s.author}</span></label><h4>{s.question}</h4><p>{s.answer}</p><button onClick={() => insert(s)}><Quote size={13}/> Inserir no manuscrito</button></article>) : <div className="no-sources">Sem testemunhos autorizados para esta página.</div>}</div><button className="assemble-button" disabled={!selectedSources.length} onClick={assemble}><ClipboardList size={16}/> Reunir {selectedSources.length || ''} testemunhos selecionados</button></aside>
    </div>
    {showPreview && <div className="preview-overlay"><div className="preview-modal"><div className="preview-header"><div><span>PRÉ-VISUALIZAÇÃO DO MANUSCRITO</span><h2>A Vida de um Estudante de Medicina · Volume II</h2></div><button onClick={() => setShowPreview(false)}>Fechar ✕</button></div><div className="preview-paper"><div className="preview-cover"><span>VIDAS QUE CURAM</span><h1>A vida de um<br/><em>estudante de</em><br/>Medicina</h1><p>Volume II · Memórias de uma geração · 2026</p></div>{pages.filter(p => p.body.trim()).sort((a,b) => {const order = (p: Page) => p.category === 'collective' ? 0 : p.category === 'individual' ? 1 : 2; return order(a)-order(b);}).map(p => <section className="preview-chapter" key={p.key}><small>{p.category === 'collective' ? 'A NOSSA HISTÓRIA' : p.category === 'individual' ? 'AS NOSSAS VOZES' : 'CARTAS PARA GUARDAR'}</small><h2>{p.title}</h2><div>{p.body}</div><small>ESTADO: {p.status}</small></section>)}</div><div className="preview-actions"><button onClick={() => window.print()}><Printer size={16}/> Imprimir / guardar como PDF</button><button onClick={download}><Download size={16}/> Descarregar Markdown</button></div></div></div>}
  </div>;
}
