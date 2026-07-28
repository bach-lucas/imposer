import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();

type DocumentItem = { name: string; dataUrl: string };
const DOCUMENT_KEY = 'imposer.current-document';

function readDocument(): DocumentItem | null {
  const stored = localStorage.getItem(DOCUMENT_KEY);
  return stored ? JSON.parse(stored) as DocumentItem : null;
}

function PdfViewer({ document }: { document: DocumentItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pageWrapRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPage(1); setError(false);
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
      const bounds = pageWrapRef.current?.getBoundingClientRect();
      const availableWidth = Math.max((bounds?.width ?? baseViewport.width) - 28, 120);
      const availableHeight = Math.max((bounds?.height ?? baseViewport.height) - 28, 120);
      const scale = Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height);
      const viewport = pdfPage.getViewport({ scale: Math.max(scale, 0.1) });
      canvas.width = viewport.width; canvas.height = viewport.height;
      return pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [pdf, page]);

  if (error) return <div className="pdf-error"><strong>Nao foi possivel abrir este PDF.</strong><span>Importe o arquivo novamente.</span></div>;
  return <div className="pdf-reader"><div ref={pageWrapRef} className="pdf-page-wrap"><canvas ref={canvasRef} /></div><div className="pdf-controls"><button disabled={!pdf || page <= 1} onClick={() => setPage((value) => value - 1)}>← Anterior</button><span>{page} / {pdf?.numPages ?? '...'}</span><strong>{document.name}</strong><button disabled={!pdf || page >= (pdf?.numPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Proxima →</button></div></div>;
}

function OverlayApp() {
  const [document, setDocument] = useState<DocumentItem | null>(readDocument);
  const [protectedMode, setProtectedMode] = useState(false);

  useEffect(() => {
    const refresh = () => setDocument(readDocument());
    let stopDocument: (() => void) | undefined;
    let stopProtected: (() => void) | undefined;
    listen('document-updated', refresh).then((stop) => { stopDocument = stop; });
    listen('toggle-protected', () => setProtectedMode((value) => !value)).then((stop) => { stopProtected = stop; });
    return () => { stopDocument?.(); stopProtected?.(); };
  }, []);

  useEffect(() => {
    getCurrentWindow().setIgnoreCursorEvents(protectedMode).catch(() => undefined);
  }, [protectedMode]);

  return <main className="overlay-shell"><div className="overlay-card overlay-window-card"><div className="overlay-toolbar"><div><span className="live-dot" /> GUIA ATIVO <small>· {protectedMode ? 'CLIQUES PROTEGIDOS' : 'MODO INTERACAO'}</small></div><div className="overlay-toolbar-actions"><button className={protectedMode ? 'toolbar-button selected' : 'toolbar-button'} onClick={() => setProtectedMode((value) => !value)}>Ctrl + L</button><button className="close-overlay" onClick={() => invoke('close_overlay')} title="Fechar overlay">×</button></div></div>{document ? <PdfViewer document={document} /> : <div className="overlay-empty"><div className="assistant-mark">✦</div><strong>Nenhum guia aberto</strong><span>Abra um PDF no Imposer e pressione Ctrl + F8.</span></div>}</div></main>;
}

export default function App() {
  const [document, setDocument] = useState<DocumentItem | null>(() => readDocument());
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [message, setMessage] = useState('Pronto para adicionar um guia');
  const [opacity, setOpacity] = useState(92);
  const currentWindow = getCurrentWindow();

  if (currentWindow.label === 'overlay') return <OverlayApp />;

  async function handlePdfSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    const nextDocument = { name: file.name, dataUrl };
    localStorage.setItem(DOCUMENT_KEY, JSON.stringify(nextDocument));
    setDocument(nextDocument); setMessage('PDF carregado nesta sessao');
    await emit('document-updated');
  }

  async function deleteDocument() {
    if (!document || !window.confirm(`Excluir "${document.name}"?`)) return;
    localStorage.removeItem(DOCUMENT_KEY);
    setDocument(null);
    setMessage('Guia removido');
    await emit('document-updated');
  }

  return <main className="app-shell"><aside className="sidebar"><div className="brand"><span className="brand-mark">i</span><span>imposer</span></div><p className="section-label">WORKSPACE</p><button className="nav-item active">▦ <span>Meu espaco</span></button><p className="section-label library-label">JOGO ATUAL</p><div className="game-card"><span className="game-dot" /><div><strong>Elden Ring</strong><small>Workspace ativo</small></div></div><div className="sidebar-footer"><span className="online-dot" /> Modo local</div></aside><section className="workspace"><header className="topbar"><div><span className="muted">Meu espaco /</span> Elden Ring</div><div className="session-status"><span className="online-dot" /> Assistente pronto <kbd>Ctrl + F8</kbd></div></header><div className="heading"><div><p className="eyebrow">ASSISTENTE DE REFERENCIA</p><h1>A jornada continua.<br /><em>O contexto fica com voce.</em></h1><p className="subtitle">Guias, mapas e informacoes do Elden Ring quando voce precisar — sem interromper o jogo.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => invoke('open_overlay')}>Abrir overlay</button><label className="primary-button">+ Adicionar guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div></div><section className="workspace-preview" style={{ opacity: overlayVisible ? opacity / 100 : 1 }}><div className="preview-header"><span>ULTIMO GUIA</span><strong>{document?.name ?? 'Nenhum guia adicionado'}</strong>{document && <button className="delete-button" onClick={deleteDocument}>Excluir guia</button>}</div>{document ? <PdfViewer document={document} /> : <div className="empty-pdf"><div className="assistant-mark">✦</div><h2>O que voce precisa consultar?</h2><p>Adicione um guia em PDF para preparar seu espaco de Elden Ring.</p><label className="secondary-button">Adicionar primeiro guia<input type="file" accept="application/pdf" onChange={handlePdfSelected} /></label></div>}</section><section className="next-section"><div><p className="eyebrow">CONHECIMENTO DO ELDEN RING</p><h2>Catalogo de itens</h2><p>Encontre o que precisa por nome, categoria, localizacao ou vendedor.</p></div><span className="coming-soon">EM BREVE</span></section><footer className="status-bar"><span className="status-indicator" /> {message}<label>Opacidade <input type="range" min="50" max="100" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} /> {opacity}%</label></footer></section></main>;
}
