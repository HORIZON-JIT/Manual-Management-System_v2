'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

type Annotation =
  | { type: 'circle'; cx: number; cy: number; radius: number }
  | { type: 'arrow'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'number'; x: number; y: number; value: number };

type Tool = 'arrow' | 'circle' | 'number';

interface ImageAnnotationEditorProps {
  imageDataUrl: string;
  onSave: (annotatedDataUrl: string) => void;
  onClose: () => void;
}

const ANNOTATION_COLOR = '#EF4444';
const OUTLINE_COLOR = '#FFFFFF';

export default function ImageAnnotationEditor({ imageDataUrl, onSave, onClose }: ImageAnnotationEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<Tool>('circle');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [drawing, setDrawing] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const toCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return { x, y };
  }, []);

  const drawArrow = useCallback((ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, h: number) => {
    const sx = x1 * w, sy = y1 * h, ex = x2 * w, ey = y2 * h;
    const headLen = Math.min(w, h) * 0.03;
    const angle = Math.atan2(ey - sy, ex - sx);
    const lineWidth = Math.max(2, Math.min(w, h) * 0.004);

    ctx.lineWidth = lineWidth + 3;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    ctx.fillStyle = ANNOTATION_COLOR;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }, []);

  const drawCircle = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, w: number, h: number) => {
    const px = cx * w, py = cy * h, pr = radius * Math.min(w, h);
    const lineWidth = Math.max(2, Math.min(w, h) * 0.004);

    ctx.lineWidth = lineWidth + 3;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = ANNOTATION_COLOR;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  const drawNumber = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, value: number, w: number, h: number) => {
    const px = x * w, py = y * h;
    const r = Math.min(w, h) * 0.025;
    const fontSize = Math.round(r * 1.4);

    ctx.fillStyle = ANNOTATION_COLOR;
    ctx.strokeStyle = OUTLINE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = OUTLINE_COLOR;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), px, py + 1);
  }, []);

  const redraw = useCallback((anns: Annotation[], previewArrow?: { x1: number; y1: number; x2: number; y2: number }) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    for (const a of anns) {
      if (a.type === 'arrow') drawArrow(ctx, a.x1, a.y1, a.x2, a.y2, w, h);
      else if (a.type === 'circle') drawCircle(ctx, a.cx, a.cy, a.radius, w, h);
      else if (a.type === 'number') drawNumber(ctx, a.x, a.y, a.value, w, h);
    }

    if (previewArrow) {
      drawArrow(ctx, previewArrow.x1, previewArrow.y1, previewArrow.x2, previewArrow.y2, w, h);
    }
  }, [drawArrow, drawCircle, drawNumber]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      setLoaded(true);
    };
    img.src = imageDataUrl;
  }, [imageDataUrl]);

  useEffect(() => {
    if (loaded) redraw(annotations);
  }, [loaded, annotations, redraw]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvasCoords(e);
    if (!pt) return;

    if (tool === 'arrow') {
      setDrawing(true);
      setDragStart(pt);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing || !dragStart || tool !== 'arrow') return;
    const pt = toCanvasCoords(e);
    if (!pt) return;
    redraw(annotations, { x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const pt = toCanvasCoords(e);
    if (!pt) return;

    if (tool === 'arrow' && drawing && dragStart) {
      const dx = pt.x - dragStart.x, dy = pt.y - dragStart.y;
      if (Math.sqrt(dx * dx + dy * dy) > 0.02) {
        setAnnotations(prev => [...prev, { type: 'arrow', x1: dragStart.x, y1: dragStart.y, x2: pt.x, y2: pt.y }]);
      }
      setDrawing(false);
      setDragStart(null);
    } else if (tool === 'circle') {
      setAnnotations(prev => [...prev, { type: 'circle', cx: pt.x, cy: pt.y, radius: 0.05 }]);
    } else if (tool === 'number') {
      setAnnotations(prev => [...prev, { type: 'number', x: pt.x, y: pt.y, value: nextNumber }]);
      setNextNumber(n => n + 1);
    }
  };

  const handleUndo = () => {
    if (annotations.length === 0) return;
    const removed = annotations[annotations.length - 1];
    setAnnotations(prev => prev.slice(0, -1));
    if (removed.type === 'number') {
      setNextNumber(removed.value);
    }
  };

  const handleReset = () => {
    setAnnotations([]);
    setNextNumber(1);
  };

  const handleSave = () => {
    if (annotations.length === 0) {
      onClose();
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm text-gray-300 hover:text-white transition"
        >
          リセット
        </button>
        <span className="text-sm text-gray-400">画像注釈</span>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          完了
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-gray-950 px-2">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="max-w-full max-h-full object-contain"
          style={{ touchAction: 'none', userSelect: 'none' }}
        />
      </div>

      {/* Bottom toolbar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gray-900">
        <button
          onClick={handleUndo}
          disabled={annotations.length === 0}
          className="px-3 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-30 transition"
        >
          ↩ 戻す
        </button>
        <div className="w-px h-6 bg-gray-700" />
        {([
          ['arrow', '➜ 矢印'],
          ['circle', '○ 丸'],
          ['number', '① 番号'],
        ] as [Tool, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTool(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tool === t
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
