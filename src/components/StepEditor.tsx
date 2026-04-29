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

export default function StepEditor({
  step,
  index,
  totalSteps,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: StepEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const images = getStepImages(step);

  // Use refs to avoid stale closures when multiple FileReaders resolve
  const stepRef = useRef(step);
  const imagesRef = useRef(images);
  stepRef.current = step;
  imagesRef.current = images;

  const addImage = useCallback((dataUrl: string) => {
    const s = stepRef.current;
    const imgs = imagesRef.current;
    const captions = s.imageCaptions ?? [];
    onChange({
      ...s,
      imageDataUrl: undefined,
      imageDataUrls: [...imgs, dataUrl],
      imageCaptions: [...captions, ''],
    });
  }, [onChange]);

  const removeImage = useCallback((idx: number) => {
    const s = stepRef.current;
    const updatedImgs = imagesRef.current.filter((_, i) => i !== idx);
    const updatedCaptions = (s.imageCaptions ?? []).filter((_, i) => i !== idx);
    onChange({
      ...s,
      imageDataUrl: undefined,
      imageDataUrls: updatedImgs.length > 0 ? updatedImgs : undefined,
      imageCaptions: updatedCaptions.length > 0 ? updatedCaptions : undefined,
    });
  }, [onChange]);

  const updateCaption = useCallback((idx: number, caption: string) => {
    const captions = [...(step.imageCaptions ?? [])];
    // Ensure array is long enough
    while (captions.length <= idx) captions.push('');
    captions[idx] = caption;
    onChange({ ...step, imageCaptions: captions });
  }, [onChange, step]);

  const processImageFile = useCallback((file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      alert('画像サイズは20MB以下にしてください。');
      return;
    }
    compressImage(file)
      .then((dataUrl) => addImage(dataUrl))
      .catch(() => alert('画像の処理に失敗しました。'));
  }, [addImage]);

  const handleScreenCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      await new Promise<void>((resolve) => {
        video.onloadeddata = () => resolve();
      });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/png')
      );
      const file = new File([blob], 'screenshot.png', { type: 'image/png' });
      processImageFile(file);
    } catch {
      // ユーザーがキャンセルした場合は何もしない
    }
  }, [processImageFile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(processImageFile);
    e.target.value = '';
  };

  // Paste handler that captures image paste from anywhere in the step editor
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

  // Attach paste listener to the entire step editor container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('paste', handlePaste);
    return () => el.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div ref={containerRef} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-blue-600">ステップ {index + 1}</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
            title="上へ移動"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === totalSteps - 1}
            className="p-1 text-gray-500 hover:text-blue-600 disabled:opacity-30"
            title="下へ移動"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 text-red-400 hover:text-red-600 ml-2"
            title="削除"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">タイトル</label>
          <input
            type="text"
            value={step.title}
            onChange={(e) => onChange({ ...step, title: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="例: システムにログインする"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
          <textarea
            value={step.description}
            onChange={(e) => onChange({ ...step, description: e.target.value })}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="手順の詳細を記入してください"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">注意事項（任意）</label>
          <input
            type="text"
            value={step.caution || ''}
            onChange={(e) => onChange({ ...step, caution: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
            placeholder="注意すべきポイントがあれば記入"
          />
        </div>

        {/* Image section */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            スクリーンショット・画像（任意・複数可）
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Existing images */}
          {images.length > 0 && (
            <div className="space-y-3 mb-2">
              {images.map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`}
                    className="max-w-full max-h-48 object-contain mx-auto"
                  />
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-200 space-y-1.5">
                    <input
                      type="text"
                      value={(step.imageCaptions ?? [])[imgIdx] ?? ''}
                      onChange={(e) => updateCaption(imgIdx, e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      placeholder="画像のコメントを入力..."
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">画像 {imgIdx + 1}/{images.length}</span>
                      <button
                        type="button"
                        onClick={() => removeImage(imgIdx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-600 hover:bg-blue-100 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              画像を追加
            </button>
            <button
              type="button"
              onClick={handleScreenCapture}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600 hover:bg-green-100 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              スクショ撮影
            </button>
            <span className="text-xs text-gray-400">
              Ctrl+V でスクショ貼り付けも可能
            </span>
          </div>
        </div>

        {/* Video URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">動画URL（任意）</label>
          <input
            type="url"
            value={step.videoUrl || ''}
            onChange={(e) => onChange({ ...step, videoUrl: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </div>
      </div>
    </div>
  );
}
