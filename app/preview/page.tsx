'use client';
import { useEffect, useState } from 'react';
import type { Photo } from '../../components/response-photo';
import { chapters } from '../../lib/book-chapters';

type Entry = { question: string; answer: string; author: string; visibility: string; chapter: string };

export default function PersonalPreview() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [author, setAuthor] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signedOut, setSignedOut] = useState(false);
  useEffect(() => {
    Promise.all([fetch('/api/entries'), fetch('/api/photos')]).then(async ([er, pr]) => {
      if (er.status === 401 || pr.status === 401) { setSignedOut(true); return; }
      if (!er.ok || !pr.ok) throw Error('Não foi possível abrir a prévia. Atualiza a página para tentar novamente.');
      const data = await er.json() as { entries: Entry[]; user: { name: string } };
      setEntries(data.entries); setAuthor(data.entries[0]?.author || data.user.name);
      setPhotos((await pr.json() as { photos: Photo[] }).photos);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);
  return <main className="personal-preview">
    <header className="personal-preview-toolbar"><a href="/">← Voltar às minhas respostas</a><span>PRÉVIA PESSOAL</span><button onClick={() => window.print()} disabled={loading || !!error || !entries.length}>Imprimir / guardar PDF</button></header>
    {loading ? <p className="preview-notice" role="status">A preparar as tuas páginas…</p> : signedOut ? <p className="preview-notice">Entra na tua conta para ver as tuas páginas. <a href="/entrar">Entrar</a></p> : error ? <p className="preview-notice" role="alert">{error}</p> : <>
      <p className="preview-notice">Só tu podes ver esta prévia. Inclui as respostas guardadas, com indicação das autorizações. A paginação final será definida na edição do livro.</p>
      <article className="personal-book">
        <section className="personal-book-cover"><span>VOLUME II · MEMÓRIAS DE UMA GERAÇÃO</span><div aria-hidden="true">✧</div><h1>A Vida dum<br/><em>Estudante de Medicina</em></h1><p>As páginas de</p><h2>{author}</h2><small>EDIÇÃO PESSOAL · 2026</small></section>
        {!entries.length && <section className="personal-book-page"><h2>As tuas memórias começam aqui.</h2><p>Guarda a primeira resposta para a veres nesta prévia.</p><a href="/">Começar a escrever →</a></section>}
        {chapters.map(chapter => {
          const items = chapter.questions.map(q => entries.find(e => e.question === q)).filter((e): e is Entry => !!e);
          if (!items.length) return null;
          return <section className="personal-book-chapter" key={chapter.id}><header><small>CAPÍTULO {chapter.number}</small><h2>{chapter.title}</h2><p>{chapter.kicker}</p></header>{items.map(entry => {
            const photo = photos.find(p => p.question === entry.question);
            return <section className="personal-book-page" key={entry.question}><h3>{entry.question}</h3><div className="book-prose">{entry.answer.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}</div>{photo && <figure><img src={`/api/photos/${photo.id}`} alt={photo.caption}/><figcaption>{photo.caption}<span>Na fotografia: {photo.people}</span></figcaption></figure>}<footer><span>{entry.author}</span><span>{entry.visibility === 'book' ? 'Texto autorizado para o livro' : 'Texto privado'}{photo && ` · Foto ${photo.publicationConsent && entry.visibility === 'book' ? 'autorizada' : 'privada'}`}</span></footer></section>;
          })}</section>;
        })}
      </article>
    </>}
  </main>;
}
