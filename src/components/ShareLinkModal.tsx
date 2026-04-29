'use client';

import { useState } from 'react';

interface ShareLinkModalProps {
  url: string;
  imagesIncluded: boolean;
  onClose: () => void;
}

export default function ShareLinkModal({ url, imagesIncluded, onClose }: ShareLinkModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-[#1d1d1f]">共有リンク</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f] transition text-xl">
            &times;
          </button>
        </div>

        {!imagesIncluded && (
          <div className="bg-[#fff8ec] border border-[#ff9f0a]/40 rounded-2xl px-4 py-3 mb-4">
            <p className="text-sm text-[#4a2600]">
              データが大きいため、画像は共有リンクに含まれていません。画像付きで共有する場合はWord/PDF出力をご利用ください。
            </p>
          </div>
        )}

        <textarea readOnly value={url} rows={3}
          className="w-full p-3 border border-[#d2d2d7] rounded-xl text-sm text-[#6e6e73] bg-[#f5f5f7] resize-none focus:outline-none mb-4" />

        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-[#6e6e73] border border-[#d2d2d7] rounded-full hover:bg-[#f5f5f7] transition">
            閉じる
          </button>
          <button onClick={handleCopy}
            className={`px-5 py-2 text-sm text-white rounded-full transition font-medium ${copied ? 'bg-[#34c759]' : 'bg-[#0071e3] hover:bg-[#0077ed]'}`}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
