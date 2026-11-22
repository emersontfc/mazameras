'use client';
import { useEffect, useRef, useState } from 'react';

export type Photo = { id: string; question: string; caption: string; people: string; publicationConsent: boolean };

export default function ResponsePhoto({ question, saved }: { question: string; saved: boolean }) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [caption, setCaption] = useState('');
  const [people, setPeople] = useState('');
  const [allowed, setAllowed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/photos').then(async r => {
      if (!r.ok) throw Error('Não foi possível carregar a fotografia. Volta a abrir esta página.');
      const data = await r.json() as { photos: Photo[] };
      if (!active) return;
      const item = data.photos.find(p => p.question === question) || null;
      setPhoto(item); setCaption(item?.caption || ''); setPeople(item?.people || ''); setAllowed(item?.publicationConsent || false); setReady(true);
    }).catch(e => { if (active) setMessage(e.message); });
    return () => { active = false; };
  }, [question]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const body = new FormData(event.currentTarget);
      body.set('question', question); body.set('publicationConsent', String(allowed));
      const r = await fetch(photo ? `/api/photos/${photo.id}` : '/api/photos', { method: photo ? 'PUT' : 'POST', body });
      const data = await r.json() as { id?: string; error?: string };
      if (!r.ok) throw Error(data.error || 'Não foi possível guardar a fotografia.');
      setPhoto({ id: photo?.id || data.id!, question, caption, people, publicationConsent: allowed });
      setMessage('Fotografia e autorização guardadas.');
      if (fileInput.current) fileInput.current.value = '';
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }

  async function remove() {
    if (!photo || !window.confirm('Remover esta fotografia da resposta?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/photos/${photo.id}`, { method: 'DELETE' });
      if (!r.ok) throw Error('Não foi possível remover. Tenta novamente.');
      setPhoto(null); setCaption(''); setPeople(''); setAllowed(false); setMessage('Fotografia removida.');
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }

  return <section className="response-photo" aria-label="Fotografia da resposta">
    <h4>Uma fotografia, outra memória.</h4>
    <p>Acrescenta uma fotografia a esta resposta. JPEG, PNG ou WebP, até 5 MB.</p>
    {!saved ? <p>Guarda primeiro a resposta para acrescentar a fotografia.</p> : <form onSubmit={submit}>
      <fieldset disabled={!ready || busy}>
        {photo ? <figure><img src={`/api/photos/${photo.id}`} alt={photo.caption}/><figcaption>{photo.publicationConsent ? 'Autorizada para o livro, se o texto também estiver autorizado.' : 'Fotografia privada · só tu podes vê-la.'}</figcaption></figure> : <label>ESCOLHER FOTOGRAFIA<input ref={fileInput} name="file" type="file" accept="image/jpeg,image/png,image/webp" required/></label>}
        <label>LEGENDA<input name="caption" value={caption} onChange={e => setCaption(e.target.value)} maxLength={300} required placeholder="Onde foi? Que momento recorda?"/></label>
        <label>QUEM APARECE NA FOTOGRAFIA?<input name="people" value={people} onChange={e => setPeople(e.target.value)} maxLength={500} required placeholder="Nomes das pessoas, da esquerda para a direita; ou «Sem pessoas»"/></label>
        <label className="photo-consent"><input type="checkbox" checked={allowed} onChange={e => setAllowed(e.target.checked)}/><span>Autorizo a inclusão desta fotografia no livro e confirmo que tenho autorização do autor da imagem e das pessoas identificáveis que nela aparecem.</span></label>
        <p>A fotografia fica privada até guardares esta autorização. Podes retirá-la aqui a qualquer momento.</p>
        <div className="photo-actions"><button type="submit">{busy ? 'A guardar…' : photo ? 'Guardar legenda e autorização' : 'Enviar fotografia'}</button>{photo && <button type="button" onClick={remove}>Remover fotografia</button>}</div>
      </fieldset>
    </form>}
    <p role="status">{message}</p>
  </section>;
}
