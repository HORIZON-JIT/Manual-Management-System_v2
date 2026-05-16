'use client';

import { WorkInstruction } from '@/types/instruction';
import { useEffect, useRef, useState } from 'react';
import { buildFlowchartDefinition } from '@/lib/buildFlowchart';

interface Props {
  instruction: WorkInstruction;
  onClose: () => void;
}

export default function FlowchartModal({ instruction, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const svgRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaidModule = await import('mermaid');
        const mermaid = mermaidModule.default;
        const elkModule = await import('@mermaid-js/layout-elk');
        mermaid.registerLayoutLoaders(elkModule.default);

        mermaid.initialize({
          startOnLoad: false,
          theme: 'default',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'linear',
          },
        });

        const definition = buildFlowchartDefinition(instruction);
        const { svg } = await mermaid.render(`fc-${Date.now()}`, definition);

        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          svgRef.current = svg;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e ?? 'フロー図の生成に失敗しました'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [instruction]);

  const downloadSvg = () => {
    const blob = new Blob([svgRef.current], { type: 'image/svg+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${instruction.title}_フロー図.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadPng = () => {
    const svgEl = containerRef.current?.querySelector('svg');
    if (!svgEl) return;
    const data = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth * 2;
      canvas.height = img.naturalHeight * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(pngBlob);
          a.download = `${instruction.title}_フロー図.png`;
          a.click();
          URL.revokeObjectURL(a.href);
        }
      }, 'image/png');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-800">フロー図</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading && <p className="text-sm text-gray-500 text-center py-8">読み込み中...</p>}
          {error && <p className="text-sm text-red-600 text-center py-8">{error}</p>}
          <div ref={containerRef} className="flex justify-center" />
        </div>

        {!loading && !error && (
          <div className="flex items-center justify-end gap-2 px-6 py-3 border-t">
            <button
              onClick={downloadSvg}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              SVG
            </button>
            <button
              onClick={downloadPng}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              PNG
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-sm hover:bg-slate-700 transition"
            >
              閉じる
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
