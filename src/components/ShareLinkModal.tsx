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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for non-HTTPS
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-800">共有リンク</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {!imagesIncluded && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4">
            <p className="text-sm text-yellow-800">
              データが大きいため、画像は共有リンクに含まれていません。画像付きで共有する場合はWord/PDF出力をご利用ください。
            </p>
          </div>
        )}

        <div className="mb-4">
          <textarea
            readOnly
            value={url}
            rows={3}
            className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-600 bg-gray-50 resize-none focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-100 transition"
          >
            閉じる
          </button>
          <button
            onClick={handleCopy}
            className={`px-4 py-2 text-sm text-white rounded transition ${
              copied
                ? 'bg-green-600'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            {copied ? 'コピーしました' : 'コピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
