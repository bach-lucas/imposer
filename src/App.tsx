import { ChangeEvent, useEffect, useState } from 'react';

type DocumentItem = { name: string; url: string; pages?: string };

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
      if (event.ctrlKey && event.key === 'F8') {
        event.preventDefault();
        setOverlayVisible((visible) => !visible);
        setMessage(overlayVisible ? 'Overlay oculto' : 'Overlay visível');
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [overlayVisible]);

  function handlePdfSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setDocument({ name: file.name, url: URL.createObjectURL(file) });
    setMessage('PDF carregado nesta sessão');
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">i</span><span>imposer</span></div>
        <p className="section-label">WORKSPACE</p>
        <button className="nav-item active">▦ <span>Meu espaço</span></button>
        <p className="section-label library-label">JOGO ATUAL</p>
        <div className="game-card"><span className="game-dot" /><div><strong>Elden Ring</strong><small>Workspace ativo</small></div></div>
        <div className="sidebar-footer"><span className="online-dot" /> Modo local</div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div><span className="muted">Meu espaço /</span> Elden Ring</div><kbd>Ctrl + F8</kbd></header>
        <div className="heading"><div><p className="eyebrow">PRIMEIRO SPRINT</p><h1>Seu guia, sempre à vista.</h1><p className="subtitle">Importe um PDF e consulte-o sem sair do Elden Ring.</p></div><label className="primary-button">+ Adicionar PDF<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>

        <section className="overlay-card" style={{ opacity: overlayVisible ? opacity / 100 : 0.32 }}>
          <div className="overlay-toolbar"><div><span className="live-dot" /> OVERLAY DE PDF</div><div className="toolbar-actions"><button onClick={() => setProtectedMode((value) => !value)} className={protectedMode ? 'toolbar-button selected' : 'toolbar-button'}>{protectedMode ? '♙ Protegido' : '♙ Interagir'}</button><button onClick={() => setOverlayVisible(false)} className="toolbar-button">Ocultar</button></div></div>
          <div className="pdf-stage">
            {document.url ? <iframe title={document.name} src={document.url} /> : <div className="empty-pdf"><div className="pdf-icon">PDF</div><h2>Nenhum guia aberto</h2><p>Importe um PDF para começar a montar seu espaço de Elden Ring.</p><label className="secondary-button">Selecionar PDF<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>}
          </div>
          <div className="overlay-footer"><span>{document.name}</span><span>{protectedMode ? 'Cliques passam para o jogo' : 'Modo interação ativo'} · Opacidade {opacity}%</span></div>
        </section>

        <section className="next-section"><div><p className="eyebrow">PRÓXIMO PASSO</p><h2>Catálogo de itens</h2><p>Depois do PDF, vamos importar e organizar as informações do Elden Ring.</p></div><span className="coming-soon">EM BREVE</span></section>
        <footer className="status-bar"><span className="status-indicator" /> {message}<label>Opacidade <input type="range" min="50" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /> {opacity}%</label></footer>
      </section>
    </main>
  );
}
