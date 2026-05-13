'use client';

import { UpdateHistoryEntry, InstructionSnapshot } from '@/types/instruction';

interface VersionHistoryModalProps {
  history: UpdateHistoryEntry[];
  onRestore: (snapshot: InstructionSnapshot) => void;
  onClose: () => void;
}

export default function VersionHistoryModal({ history, onRestore, onClose }: VersionHistoryModalProps) {
  const entriesWithSnapshot = history
    .map((entry, idx) => ({ entry, versionNum: idx + 1 }))
    .filter(({ entry }) => !!entry.snapshot);

  const hasImages = entriesWithSnapshot.some(({ entry }) =>
    entry.snapshot!.steps.some(s =>
      (s.imageDataUrls && s.imageDataUrls.length > 0) || !!s.imageDataUrl
    )
  );

  const handleRestore = (snapshot: InstructionSnapshot, versionNum: number) => {
    if (!confirm(`バージョン ${versionNum} の内容に戻しますか？\n現在の編集内容は上書きされます。`)) return;
    onRestore(snapshot);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">バージョン履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-3">
          {!hasImages && entriesWithSnapshot.length > 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Driveから読み込んだデータの場合のみ、画像付きで復元できます。
            </p>
          )}

          {entriesWithSnapshot.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">復元可能なバージョンはありません。</p>
          ) : (
            [...entriesWithSnapshot].reverse().map(({ entry, versionNum }) => (
              <div key={`${entry.updatedAt}-${versionNum}`} className="border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-gray-700">v{versionNum}</span>
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(entry.updatedAt).toLocaleString('ja-JP')}
                    </span>
                    <span className="text-xs text-gray-500 ml-2">{entry.updatedBy}</span>
                  </div>
                  <button
                    onClick={() => handleRestore(entry.snapshot!, versionNum)}
                    className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                  >
                    復元
                  </button>
                </div>
                {entry.note && (
                  <p className="text-xs text-gray-500 mt-1">{entry.note}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {entry.snapshot!.title} / {entry.snapshot!.steps.length}ステップ
                </p>
              </div>
            ))
          )}
        </div>

        <div className="px-6 py-3 border-t border-gray-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
