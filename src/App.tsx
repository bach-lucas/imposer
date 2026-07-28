import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

type DocumentItem = { name: string; dataUrl: string };
type CatalogItem = { name: string; category: string; icon: string; location: string; acquisition: string; vendor: string; sellable: string; description: string };
const DOCUMENT_KEY = 'imposer.current-document';

const CATALOG_ITEMS: CatalogItem[] = [
  { name: 'Uchigatana', category: 'Armas', icon: '⚔', location: 'Catacumbas dos Mortos', acquisition: 'Encontrada em um cadáver dentro da masmorra.', vendor: 'Comerciantes', sellable: 'Sim', description: 'Uma katana inicial associada ao estilo de combate do samurai.' },
  { name: 'Golden Seed', category: 'Consumíveis', icon: '✦', location: 'Vários locais', acquisition: 'Encontrada próxima a pequenas árvores douradas.', vendor: 'Nao aplicável', sellable: 'Nao', description: 'Aumenta a quantidade de cargas disponíveis no Frasco.' },
  { name: 'Green Turtle Talisman', category: 'Talismãs', icon: '◈', location: 'Summonwater Village', acquisition: 'Encontrado em um baú subterrâneo.', vendor: 'Comerciantes', sellable: 'Sim', description: 'Aumenta a velocidade de recuperação de stamina.' },
];

function readDocument(): DocumentItem | null {
  const stored = localStorage.getItem(DOCUMENT_KEY);
  return stored ? JSON.parse(stored) as DocumentItem : null;
}

function PdfViewer({ document }: { document: DocumentItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPage(1); setZoom(1.1); setError(false);
    pdfjsLib.getDocument(document.dataUrl).promise.then((loaded) => { if (!cancelled) setPdf(loaded); }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [document.dataUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    pdf.getPage(page).then((pdfPage) => {
      if (cancelled || !canvasRef.current) return;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;
      const baseViewport = pdfPage.getViewport({ scale: 1 });
      const width = Math.max((pageWrapRef.current?.getBoundingClientRect().width ?? baseViewport.width) - 28, 120);
      const viewport = pdfPage.getViewport({ scale: Math.max((width / baseViewport.width) * zoom, 0.1) });
      canvas.width = viewport.width; canvas.height = viewport.height;
      return pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [pdf, page, zoom]);

  if (error) return <div className="pdf-error"><strong>Nao foi possivel abrir este PDF.</strong><span>Importe o arquivo novamente.</span></div>;
  return <div className="pdf-reader"><div ref={pageWrapRef} className="pdf-page-wrap"><canvas ref={canvasRef} /></div><div className="pdf-controls"><button disabled={!pdf || page <= 1} onClick={() => setPage((value) => value - 1)}>← Anterior</button><span>{page} / {pdf?.numPages ?? '...'}</span><strong>{document.name}</strong><div className="zoom-controls"><button onClick={() => setZoom((value) => Math.max(.75, value - .1))}>−</button><span>{Math.round(zoom * 100)}%</span><button onClick={() => setZoom((value) => Math.min(2, value + .1))}>+</button></div><button disabled={!pdf || page >= (pdf?.numPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Proxima →</button></div></div>;
}

function OverlayApp() {
  const [document, setDocument] = useState<DocumentItem | null>(readDocument);
  const [protectedMode, setProtectedMode] = useState(false);

  useEffect(() => {
    let stopDocument: (() => void) | undefined;
    let stopProtected: (() => void) | undefined;
    listen('document-updated', () => setDocument(readDocument())).then((stop) => { stopDocument = stop; });
    listen('toggle-protected', () => setProtectedMode((value) => !value)).then((stop) => { stopProtected = stop; });
    return () => { stopDocument?.(); stopProtected?.(); };
  }, []);

  useEffect(() => { getCurrentWindow().setIgnoreCursorEvents(protectedMode).catch(() => undefined); }, [protectedMode]);

  return <main className="overlay-shell"><div className="overlay-card overlay-window-card"><div className="overlay-toolbar"><div className="overlay-drag-handle" data-tauri-drag-region onMouseDown={() => getCurrentWindow().startDragging().catch(() => undefined)}><span className="live-dot" /> GUIA ATIVO <small>· {protectedMode ? 'CLIQUES PROTEGIDOS' : 'MODO INTERACAO'}</small></div><div className="overlay-toolbar-actions"><button className={protectedMode ? 'toolbar-button selected' : 'toolbar-button'} onClick={() => setProtectedMode((value) => !value)}>Ctrl + L</button><button className="close-overlay" onClick={() => invoke('close_overlay')} title="Fechar overlay">×</button></div></div>{document ? <PdfViewer document={document} /> : <div className="overlay-empty"><div className="assistant-mark">✦</div><strong>Nenhum guia aberto</strong><span>Abra um PDF no Imposer e pressione Ctrl + F8.</span></div>}</div></main>;
}

function CatalogPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todos');
  const [selected, setSelected] = useState<CatalogItem>(CATALOG_ITEMS[0]);
  const categories = ['Todos', 'Armas', 'Consumíveis', 'Talismãs'];
  const results = CATALOG_ITEMS.filter((item) => (category === 'Todos' || item.category === category) && item.name.toLowerCase().includes(query.toLowerCase()));

  return <section className="catalog-section"><div className="catalog-heading"><div><p className="eyebrow">CONHECIMENTO DO ELDEN RING</p><h2>Catálogo de itens</h2><p>Pesquise por nome, categoria, localização ou vendedor.</p></div><span className="catalog-status">DEMONSTRAÇÃO</span></div><div className="catalog-toolbar"><div className="catalog-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar item..." /></div><div className="catalog-filters">{categories.map((itemCategory) => <button key={itemCategory} className={category === itemCategory ? 'active' : ''} onClick={() => setCategory(itemCategory)}>{itemCategory}</button>)}</div></div><div className="catalog-body"><div className="item-list">{results.map((item) => <button key={item.name} className={selected.name === item.name ? 'item-row selected' : 'item-row'} onClick={() => setSelected(item)}><span className="item-icon">{item.icon}</span><span><strong>{item.name}</strong><small>{item.category}</small></span><span className="item-arrow">→</span></button>)}</div><article className="item-detail"><div className="detail-icon">{selected.icon}</div><p className="eyebrow">{selected.category}</p><h3>{selected.name}</h3><p className="detail-description">{selected.description}</p><div className="detail-grid"><div><small>ONDE ENCONTRAR</small><strong>{selected.location}</strong></div><div><small>COMO OBTER</small><strong>{selected.acquisition}</strong></div><div><small>VENDEDOR</small><strong>{selected.vendor}</strong></div><div><small>VENDÁVEL</small><strong>{selected.sellable}</strong></div></div></article></div></section>;
}

export default function App() {
  const [document, setDocument] = useState<DocumentItem | null>(() => readDocument());
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [message, setMessage] = useState('Pronto para adicionar um guia');
  const [opacity, setOpacity] = useState(92);
  const currentWindow = getCurrentWindow();
  if (currentWindow.label === 'overlay') return <OverlayApp />;

  async function handlePdfSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const nextDocument = { name: file.name, dataUrl }; localStorage.setItem(DOCUMENT_KEY, JSON.stringify(nextDocument)); setDocument(nextDocument); setMessage('PDF carregado nesta sessao'); await emit('document-updated');
  }

  async function deleteDocument() {
    if (!document || !window.confirm(`Excluir "${document.name}"?`)) return;
    localStorage.removeItem(DOCUMENT_KEY); setDocument(null); setMessage('Guia removido'); await emit('document-updated');
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">i</span><span>imposer</span></div><p className="section-label">WORKSPACE</p><button className="nav-item active">▦ <span>Meu espaco</span></button><p className="section-label library-label">JOGO ATUAL</p><div className="game-card"><span className="game-dot" /><div><strong>Elden Ring</strong><small>Workspace ativo</small></div></div><div className="sidebar-footer"><span className="online-dot" /> Modo local</div></aside><section className="workspace"><header className="topbar"><div><span className="muted">Meu espaco /</span> Elden Ring</div><div className="session-status"><span className="online-dot" /> Assistente pronto <kbd>Ctrl + F8</kbd></div></header><div className="heading"><div><p className="eyebrow">ASSISTENTE DE REFERENCIA</p><h1>A jornada continua.<br /><em>O contexto fica com voce.</em></h1><p className="subtitle">Guias, mapas e informacoes do Elden Ring quando voce precisar — sem interromper o jogo.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => invoke('open_overlay')}>Abrir overlay</button><label className="primary-button">+ Adicionar guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div></div><section className="workspace-preview"><div className="preview-header"><span>ULTIMO GUIA</span><strong>{document?.name ?? 'Nenhum guia adicionado'}</strong>{document && <button className="delete-button" onClick={deleteDocument}>Excluir guia</button>}</div>{document ? <PdfViewer document={document} /> : <div className="empty-pdf"><div className="assistant-mark">✦</div><h2>O que voce precisa consultar?</h2><p>Adicione um guia em PDF para preparar seu espaco de Elden Ring.</p><label className="secondary-button">Adicionar primeiro guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>}</section><CatalogPanel /><footer className="status-bar"><span className="status-indicator" /> {message}<label>Opacidade <input type="range" min="50" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /> {opacity}%</label></footer></section></main>;
}
