import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  PenTool,
  Circle,
  MoveRight,
  Minus,
  Undo2,
  RotateCcw,
  Check,
  Save,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';

// Dynamic loader for PDF.js to render PDF blueprints & technical drawings onto the canvas
const loadPdfJs = () => {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return Promise.resolve(window.pdfjsLib);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      try {
        if (window.pdfjsLib) {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
      } catch (e) {
        console.warn('PDF.js worker initialization note:', e);
      }
      resolve(window.pdfjsLib);
    };
    script.onerror = () => {
      // Secondary CDN fallback
      const fallback = document.createElement('script');
      fallback.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js';
      fallback.onload = () => {
        try {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
          }
        } catch (e) {}
        resolve(window.pdfjsLib);
      };
      fallback.onerror = reject;
      document.head.appendChild(fallback);
    };
    document.head.appendChild(script);
  });
};

/**
 * ImageAnnotationModal
 * Allows users to annotate technical drawings, PDF blueprints, and defect images
 * with Circles, Arrows, Lines, and Sketches (freehand pen).
 * 
 * Props:
 * - isOpen: boolean
 * - imageAttachment: { file?: File, url?: string, name?: string, isPdf?: boolean }
 * - onClose: () => void
 * - onSave: (annotatedFile: File, newPreviewUrl: string) => void
 */
const ImageAnnotationModal = ({ isOpen, imageAttachment, onClose, onSave }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const originalImageRef = useRef(null);
  const snapshotRef = useRef(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const isDrawingRef = useRef(false);

  // Tools: 'pen' (sketches), 'circle', 'arrow', 'line'
  const [activeTool, setActiveTool] = useState('circle');
  const [strokeColor, setStrokeColor] = useState('#ef4444'); // Red default (standard defect color)
  const [strokeWidth, setStrokeWidth] = useState(4); // 2, 4, 7
  const [undoStack, setUndoStack] = useState([]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  // PDF Multi-page Support
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingFile, setIsLoadingFile] = useState(false);

  const COLORS = [
    { label: 'Red', value: '#ef4444', bg: 'bg-red-500' },
    { label: 'Yellow', value: '#eab308', bg: 'bg-yellow-500' },
    { label: 'Green', value: '#22c55e', bg: 'bg-emerald-500' },
    { label: 'Blue', value: '#3b82f6', bg: 'bg-blue-500' },
    { label: 'White', value: '#ffffff', bg: 'bg-white border border-slate-300' },
    { label: 'Black', value: '#0f172a', bg: 'bg-slate-900' },
  ];

  const STROKE_WIDTHS = [
    { label: 'Thin', value: 2 },
    { label: 'Medium', value: 4 },
    { label: 'Thick', value: 7 },
  ];

  const isPdf = React.useMemo(() => {
    if (!imageAttachment) return false;
    const ext = (imageAttachment.name?.split('.').pop() || imageAttachment.type || '').toUpperCase();
    return ext === 'PDF' || imageAttachment.isPdf === true || (imageAttachment.file && imageAttachment.file.type === 'application/pdf');
  }, [imageAttachment]);

  // Resolve active image or PDF source URL
  const fileUrl = React.useMemo(() => {
    if (!imageAttachment) return '';
    if (imageAttachment.url) return imageAttachment.url;
    if (imageAttachment.file) {
      try {
        return URL.createObjectURL(imageAttachment.file);
      } catch {
        return '';
      }
    }
    return '';
  }, [imageAttachment]);

  // Render a PDF page onto canvas
  const renderPdfPage = async (doc, pageNum) => {
    if (!doc || !canvasRef.current) return;
    try {
      setIsLoadingFile(true);
      const page = await doc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });
      // Scale up to 2.2x or max 1920px for crisp technical lines
      const targetScale = Math.min(2.5, Math.max(1.3, 1920 / unscaledViewport.width));
      const viewport = page.getViewport({ scale: targetScale });

      const canvas = canvasRef.current;
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport }).promise;

      const initialState = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setUndoStack([initialState]);
      setImageLoaded(true);
    } catch (err) {
      console.error('Failed to render PDF page onto canvas:', err);
      setLoadingError(true);
    } finally {
      setIsLoadingFile(false);
    }
  };

  // Load and draw file (Image or PDF) onto canvas
  useEffect(() => {
    if (!isOpen || (!fileUrl && !imageAttachment?.file)) return;

    setImageLoaded(false);
    setLoadingError(false);
    setUndoStack([]);

    // 1. PDF Document Loading
    if (isPdf) {
      let isCancelled = false;
      (async () => {
        try {
          setIsLoadingFile(true);
          const pdfjs = await loadPdfJs();
          let pdfData = null;
          if (imageAttachment.file && typeof imageAttachment.file.arrayBuffer === 'function') {
            pdfData = await imageAttachment.file.arrayBuffer();
          } else if (fileUrl) {
            const res = await fetch(fileUrl);
            pdfData = await res.arrayBuffer();
          }

          if (isCancelled || !pdfData) return;
          const loadingTask = pdfjs.getDocument({ data: pdfData });
          const doc = await loadingTask.promise;
          if (isCancelled) return;

          setPdfDoc(doc);
          setTotalPages(doc.numPages || 1);
          setCurrentPage(1);

          await renderPdfPage(doc, 1);
        } catch (err) {
          if (!isCancelled) {
            console.error('Failed to load PDF for annotation:', err);
            setLoadingError(true);
          }
        } finally {
          if (!isCancelled) setIsLoadingFile(false);
        }
      })();

      return () => {
        isCancelled = true;
      };
    }

    // 2. Standard Image Loading (PNG, JPG, WEBP)
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      originalImageRef.current = img;

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Restrict max internal canvas dimensions to 1920px for crisp drawing & high performance
      let width = img.naturalWidth || 1024;
      let height = img.naturalHeight || 768;
      const MAX_DIM = 1920;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Save initial state to undo stack
      const initialState = ctx.getImageData(0, 0, width, height);
      setUndoStack([initialState]);
      setImageLoaded(true);
    };

    img.onerror = () => {
      console.error('Failed to load image for annotation');
      setLoadingError(true);
    };

    img.src = fileUrl;
  }, [isOpen, fileUrl, imageAttachment, isPdf]);

  // Transform client coordinates to native canvas internal resolution
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0] ? e.touches[0].clientY : 0);

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drawing Shape Helpers
  const drawArrow = (ctx, fromX, fromY, toX, toY, width, color) => {
    const headlen = Math.max(14, width * 3.5);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  const drawCircle = (ctx, startX, startY, endX, endY, width, color) => {
    const rx = Math.abs(endX - startX) / 2;
    const ry = Math.abs(endY - startY) / 2;
    const cx = (startX + endX) / 2;
    const cy = (startY + endY) / 2;

    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };

  const drawLine = (ctx, startX, startY, endX, endY, width, color) => {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  // Mouse & Touch Event Handlers
  const handleStart = (e) => {
    if (!imageLoaded || !canvasRef.current) return;
    if (e.touches && e.touches.length > 1) return; // Ignore multi-touch gestures

    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasCoords(e);

    isDrawingRef.current = true;
    startPosRef.current = pos;
    snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (activeTool === 'pen') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handleMove = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getCanvasCoords(e);

    if (activeTool === 'pen') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else {
      // For shapes: restore snapshot before drawing current drag preview
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0);
      }

      if (activeTool === 'circle') {
        drawCircle(ctx, startPosRef.current.x, startPosRef.current.y, pos.x, pos.y, strokeWidth, strokeColor);
      } else if (activeTool === 'arrow') {
        drawArrow(ctx, startPosRef.current.x, startPosRef.current.y, pos.x, pos.y, strokeWidth, strokeColor);
      } else if (activeTool === 'line') {
        drawLine(ctx, startPosRef.current.x, startPosRef.current.y, pos.x, pos.y, strokeWidth, strokeColor);
      }
    }
  };

  const handleEnd = (e) => {
    if (!isDrawingRef.current || !canvasRef.current) return;
    if (e) e.preventDefault();

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    isDrawingRef.current = false;

    // Record new state in history for Undo
    const newState = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack((prev) => [...prev, newState]);
    snapshotRef.current = null;
  };

  // Undo last action
  const handleUndo = () => {
    if (undoStack.length <= 1 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const nextStack = [...undoStack];
    nextStack.pop(); // Remove current state
    const previousState = nextStack[nextStack.length - 1];

    ctx.putImageData(previousState, 0, 0);        
    setUndoStack(nextStack);
  };

  // Reset to original image or PDF state
  const handleClear = () => {
    if (!canvasRef.current || undoStack.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const firstState = undoStack[0];
    if (firstState) {
      ctx.putImageData(firstState, 0, 0);
      setUndoStack([firstState]);
    }
  };

  // Save annotated drawing as a new File and update attachment
  const handleSaveAnnotated = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;

        const baseName = (imageAttachment?.name || 'technical_drawing')
          .replace(/\.[^/.]+$/, '')
          .replace(/_annotated$/, '');
        const pageSuffix = isPdf && totalPages > 1 ? `_p${currentPage}` : '';
        const newFileName = `${baseName}${pageSuffix}_annotated.png`;

        const annotatedFile = new File([blob], newFileName, {
          type: 'image/png',
          lastModified: Date.now(),
        });

        const newPreviewUrl = URL.createObjectURL(blob);
        onSave(annotatedFile, newPreviewUrl);
        onClose();
      },
      'image/png',
      0.95
    );
  };

  if (!isOpen || !imageAttachment) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[920px] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header (White Theme) */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
              <PenTool className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate flex items-center gap-2">
                <span>{isPdf ? 'Annotate PDF Blueprint:' : 'Annotate Drawing:'}</span>
                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-mono text-xs border border-blue-100 truncate max-w-[200px] sm:max-w-md">
                  {imageAttachment?.name || 'Technical Image'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Mark defect locations, highlight dimensions, or add sketch callouts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Multi-page PDF page switcher */}
            {isPdf && totalPages > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-xl text-xs font-semibold text-slate-700 mr-1 shadow-2xs">
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  type="button"
                  disabled={currentPage <= 1 || isLoadingFile}
                  onClick={() => {
                    const nextP = currentPage - 1;
                    setCurrentPage(nextP);
                    renderPdfPage(pdfDoc, nextP);
                  }}
                  className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 cursor-pointer transition"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages || isLoadingFile}
                  onClick={() => {
                    const nextP = currentPage + 1;
                    setCurrentPage(nextP);
                    renderPdfPage(pdfDoc, nextP);
                  }}
                  className="p-1 rounded hover:bg-white text-slate-600 disabled:opacity-30 cursor-pointer transition"
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              title="Undo last annotation"
            >
              <Undo2 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Undo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={undoStack.length <= 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
              title="Clear all annotations"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Clear</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAnnotated}
              disabled={!imageLoaded}
              className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm shadow-blue-600/20 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Save Annotation</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer ml-1"
              title="Close without saving"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Bar (White Theme) */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          
          {/* Tool Selector Buttons */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveTool('circle')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === 'circle'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Circle / Ellipse Tool - Highlight defects or callout spots"
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Circle</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('arrow')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === 'arrow'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Arrow Tool - Point directly at the deviation"
            >
              <MoveRight className="w-3.5 h-3.5" />
              <span>Arrow</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('line')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === 'line'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Line Tool - Straight line for alignment"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Line</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('pen')}
              className={`px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTool === 'pen'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Sketch Tool - Freehand pen drawing"
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Sketch</span>
            </button>
          </div>

          {/* Color & Stroke Width Controls */}
          <div className="flex items-center gap-4">
            
            {/* Color Palette */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">Color:</span>
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setStrokeColor(c.value)}
                    className={`w-6 h-6 rounded-lg ${c.bg} transition transform hover:scale-110 flex items-center justify-center cursor-pointer ${
                      strokeColor === c.value ? 'ring-2 ring-blue-500 scale-105' : 'opacity-85 hover:opacity-100'
                    }`}
                    title={c.label}
                  >
                    {strokeColor === c.value && (
                      <Check className={`w-3 h-3 ${c.value === '#ffffff' ? 'text-slate-900' : 'text-white'}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Stroke Width Picker */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">Size:</span>
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                {STROKE_WIDTHS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStrokeWidth(s.value)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                      strokeWidth === s.value
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Canvas Working Viewport (Light drafting background) */}
        <div
          ref={containerRef}
          className="flex-1 bg-slate-100/90 overflow-auto flex items-center justify-center p-4 relative"
        >
          {loadingError ? (
            <div className="text-center p-8 bg-white border border-rose-200 rounded-2xl shadow-sm text-slate-600">
              <p className="font-semibold text-rose-600">Failed to load image for drawing</p>
              <p className="text-xs mt-1 text-slate-500">Please try re-uploading the file</p>
            </div>
          ) : (
            <div className="relative inline-block max-w-full max-h-full rounded-xl overflow-hidden shadow-lg border border-slate-300 bg-white">
              <canvas
                ref={canvasRef}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                className="block max-w-full max-h-[calc(92vh-160px)] w-auto h-auto cursor-crosshair touch-none select-none"
              />
              {(!imageLoaded || isLoadingFile) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-xs text-xs font-semibold text-slate-700 gap-2">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <span>{isPdf ? 'Rendering PDF Blueprint to canvas...' : 'Loading image into canvas...'}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Helpful Guide (White Theme) */}
        <div className="px-5 py-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active Tool: <strong className="text-slate-800">{activeTool.toUpperCase()}</strong> ({strokeColor})</span>
            <span className="hidden sm:inline text-slate-400">• Click &amp; drag on the drawing to create annotations</span>
          </div>
          <div>
            <span className="font-medium text-slate-600">{undoStack.length > 1 ? `${undoStack.length - 1} mark(s) applied` : 'Ready to annotate'}</span>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ImageAnnotationModal;
