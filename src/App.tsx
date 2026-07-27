import { ChangeEvent, useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

type DocumentItem = { name: string; url: string };

const INITIAL_DOCUMENT: DocumentItem = {
  name: 'Adicione seu primeiro guia em PDF',
  url: '',
};

export default function App() {
  const [document, setDocument] = useState<DocumentItem>(INITIAL_DOCUMENT);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [protectedMode, setProtectedMode] = useState(false);
  const [opacity, setOpacity] = useState(92);
  const [message, setMessage] = useState('Pronto para adicionar um guia');

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ('__TAURI_INTERNALS__' in window) return;
      if (event.ctrlKey && event.key === 'F8') {
        event.preventDefault();
        setOverlayVisible((visible) => !visible);
        setMessage(overlayVisible ? 'Overlay oculto' : 'Overlay visivel');
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [overlayVisible]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    listen('toggle-overlay', () => {
      setOverlayVisible((visible) => !visible);
      setMessage('Overlay alternado pelo atalho');
    }).then((stop) => { unlisten = stop; }).catch(() => {
      setMessage('Atalho global indisponivel nesta sessao');
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    getCurrentWindow().setIgnoreCursorEvents(protectedMode).catch(() => undefined);
  }, [protectedMode]);

  function handlePdfSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setDocument({ name: file.name, url: URL.createObjectURL(file) });
    setMessage('PDF carregado nesta sessao');
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">i</span><span>imposer</span></div>
        <p className="section-label">WORKSPACE</p>
        <button className="nav-item active">▦ <span>Meu espaco</span></button>
        <p className="section-label library-label">JOGO ATUAL</p>
        <div className="game-card"><span className="game-dot" /><div><strong>Elden Ring</strong><small>Workspace ativo</small></div></div>
        <div className="sidebar-footer"><span className="online-dot" /> Modo local</div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><span className="muted">Meu espaco /</span> Elden Ring</div><div className="session-status"><span className="online-dot" /> Assistente pronto <kbd>Ctrl + F8</kbd></div></header>
        <div className="heading"><div><p className="eyebrow">ASSISTENTE DE REFERENCIA</p><h1>A jornada continua.<br /><em>O contexto fica com voce.</em></h1><p className="subtitle">Guias, mapas e informacoes do Elden Ring quando voce precisar — sem interromper o jogo.</p></div><label className="primary-button">+ Adicionar guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>

        <section className="overlay-card" style={{ opacity: overlayVisible ? opacity / 100 : 0.32 }}>
          <div className="overlay-toolbar"><div><span className="live-dot" /> MODO OVERLAY <small>· GUIA ATIVO</small></div><div className="toolbar-actions"><button onClick={() => setProtectedMode((value) => !value)} className={protectedMode ? 'toolbar-button selected' : 'toolbar-button'}>{protectedMode ? '♙ Cliques protegidos' : '♙ Interagir com o guia'}</button><button onClick={() => setOverlayVisible(false)} className="toolbar-button">Ocultar</button></div></div>
          <div className="pdf-stage">
            {document.url ? <iframe title={document.name} src={document.url} /> : <div className="empty-pdf"><div className="assistant-mark">✦</div><h2>O que voce precisa consultar?</h2><p>Adicione um guia em PDF e eu mantenho tudo pronto para a sua proxima sessao.</p><label className="secondary-button">Adicionar primeiro guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>}
          </div>
          <div className="overlay-footer"><span>{document.name}</span><span>{protectedMode ? 'Cliques passam para o jogo' : 'Modo interacao ativo'} · Opacidade {opacity}%</span></div>
        </section>

        <section className="next-section"><div><p className="eyebrow">CONHECIMENTO DO ELDEN RING</p><h2>Catalogo de itens</h2><p>Encontre o que precisa por nome, categoria, localizacao ou vendedor.</p></div><span className="coming-soon">EM BREVE</span></section>
        <footer className="status-bar"><span className="status-indicator" /> {message}<label>Opacidade <input type="range" min="50" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /> {opacity}%</label></footer>
      </section>
    </main>
  );
}
