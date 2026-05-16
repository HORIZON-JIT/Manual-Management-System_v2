'use client';

import { UpdateHistoryEntry, InstructionSnapshot } from '@/types/instruction';

interface ViewHistoryModalProps {
  history: UpdateHistoryEntry[];
  onView: (snapshot: InstructionSnapshot) => void;
  onClose: () => void;
}

export default function ViewHistoryModal({ history, onView, onClose }: ViewHistoryModalProps) {
  const entriesWithSnapshot = history
    .map((entry, idx) => ({ entry, versionNum: idx + 1 }))
    .filter(({ entry }) => !!entry.snapshot);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">改版履歴</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-4 space-y-3">
          {entriesWithSnapshot.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">過去のバージョンはありません。</p>
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
                    onClick={() => onView(entry.snapshot!)}
                    className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition"
                  >
                    閲覧
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
