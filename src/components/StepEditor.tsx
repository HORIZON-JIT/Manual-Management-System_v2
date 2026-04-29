'use client';

import { Step, getStepImages } from '@/types/instruction';
import { useRef, useCallback, useEffect } from 'react';
import { compressImage } from '@/lib/compressImage';

interface StepEditorProps {
  step: Step;
  index: number;
  totalSteps: number;
  onChange: (step: Step) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const inputCls = 'w-full border border-[#d2d2d7] rounded-xl px-3 py-2 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none bg-white transition';
const labelCls = 'block text-sm font-medium text-[#1d1d1f] mb-1.5';

export default function StepEditor({
  step, index, totalSteps, onChange, onRemove, onMoveUp, onMoveDown,
}: StepEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const images = getStepImages(step);
  const stepRef = useRef(step);
  const imagesRef = useRef(images);
  stepRef.current = step;
  imagesRef.current = images;

  const addImage = useCallback((dataUrl: string) => {
    const s = stepRef.current;
    const imgs = imagesRef.current;
    const captions = s.imageCaptions ?? [];
    onChange({ ...s, imageDataUrl: undefined, imageDataUrls: [...imgs, dataUrl], imageCaptions: [...captions, ''] });
  }, [onChange]);

  const removeImage = useCallback((idx: number) => {
    const s = stepRef.current;
    const updatedImgs = imagesRef.current.filter((_, i) => i !== idx);
    const updatedCaptions = (s.imageCaptions ?? []).filter((_, i) => i !== idx);
    onChange({ ...s, imageDataUrl: undefined, imageDataUrls: updatedImgs.length > 0 ? updatedImgs : undefined, imageCaptions: updatedCaptions.length > 0 ? updatedCaptions : undefined });
  }, [onChange]);

  const updateCaption = useCallback((idx: number, caption: string) => {
    const captions = [...(step.imageCaptions ?? [])];
    while (captions.length <= idx) captions.push('');
    captions[idx] = caption;
    onChange({ ...step, imageCaptions: captions });
  }, [onChange, step]);

  const processImageFile = useCallback((file: File) => {
    if (file.size > 20 * 1024 * 1024) { alert('画像サイズは20MB以下にしてください。'); return; }
    compressImage(file).then((dataUrl) => addImage(dataUrl)).catch(() => alert('画像の処理に失敗しました。'));
  }, [addImage]);

  const handleScreenCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream; video.autoplay = true;
      await new Promise<void>((resolve) => { video.onloadeddata = () => resolve(); });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop()); video.srcObject = null;
      const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
      processImageFile(new File([blob], 'screenshot.png', { type: 'image/png' }));
    } catch { /* ユーザーキャンセル */ }
  }, [processImageFile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(processImageFile);
    e.target.value = '';
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return;
      }
    }
  }, [processImageFile]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div ref={containerRef} className="bg-white rounded-2xl border border-[#e8e8ed] p-5">
      {/* Step header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-[#0071e3] text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-semibold text-[#1d1d1f]">ステップ {index + 1}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={onMoveUp} disabled={index === 0}
            className="p-1.5 text-[#86868b] hover:text-[#1d1d1f] disabled:opacity-30 rounded-lg hover:bg-[#f5f5f7] transition" title="上へ移動">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button type="button" onClick={onMoveDown} disabled={index === totalSteps - 1}
            className="p-1.5 text-[#86868b] hover:text-[#1d1d1f] disabled:opacity-30 rounded-lg hover:bg-[#f5f5f7] transition" title="下へ移動">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button type="button" onClick={onRemove}
            className="p-1.5 text-[#86868b] hover:text-[#ff3b30] rounded-lg hover:bg-[#fff2f2] transition ml-1" title="削除">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>タイトル</label>
          <input type="text" value={step.title} onChange={(e) => onChange({ ...step, title: e.target.value })}
            className={inputCls} placeholder="例: システムにログインする" />
        </div>

        <div>
          <label className={labelCls}>説明</label>
          <textarea value={step.description} onChange={(e) => onChange({ ...step, description: e.target.value })}
            rows={3} className={`${inputCls} resize-y`} placeholder="手順の詳細を記入してください" />
        </div>

        <div>
          <label className={labelCls}>注意事項（任意）</label>
          <input type="text" value={step.caution || ''} onChange={(e) => onChange({ ...step, caution: e.target.value })}
            className={inputCls} placeholder="注意すべきポイントがあれば記入" />
        </div>

        {/* Images */}
        <div>
          <label className={labelCls}>スクリーンショット・画像（任意・複数可）</label>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />

          {images.length > 0 && (
            <div className="space-y-3 mb-3">
              {images.map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="rounded-xl border border-[#e8e8ed] overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`}
                    className="max-w-full max-h-48 object-contain mx-auto" />
                  <div className="px-3 py-2 bg-[#f5f5f7] border-t border-[#e8e8ed] space-y-1.5">
                    <input type="text" value={(step.imageCaptions ?? [])[imgIdx] ?? ''}
                      onChange={(e) => updateCaption(imgIdx, e.target.value)}
                      className="w-full border border-[#d2d2d7] rounded-lg px-2 py-1 text-xs text-[#1d1d1f] placeholder:text-[#86868b] focus:ring-1 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none bg-white"
                      placeholder="画像のコメントを入力..." />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#86868b]">画像 {imgIdx + 1}/{images.length}</span>
                      <button type="button" onClick={() => removeImage(imgIdx)}
                        className="text-xs text-[#ff3b30] hover:opacity-70 transition">削除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d2d2d7] rounded-full text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition">
              <svg className="w-4 h-4 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              画像を追加
            </button>
            <button type="button" onClick={handleScreenCapture}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#d2d2d7] rounded-full text-sm text-[#1d1d1f] hover:bg-[#f5f5f7] transition">
              <svg className="w-4 h-4 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              スクショ撮影
            </button>
            <span className="text-xs text-[#86868b]">Ctrl+V でスクショ貼り付けも可能</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>動画URL（任意）</label>
          <input type="url" value={step.videoUrl || ''} onChange={(e) => onChange({ ...step, videoUrl: e.target.value })}
            className={inputCls} placeholder="https://www.youtube.com/watch?v=..." />
        </div>
      </div>
    </div>
  );
}
