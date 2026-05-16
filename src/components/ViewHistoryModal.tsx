'use client';

import { UpdateHistoryEntry, InstructionSnapshot } from '@/types/instruction';

interface DisplayVersion {
  versionNum: number;
  snapshot?: InstructionSnapshot;
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
  isCurrent: boolean;
  stepCount: number;
  title: string;
}

interface ViewHistoryModalProps {
  history: UpdateHistoryEntry[];
  currentTitle: string;
  currentStepCount: number;
  createdAt: string;
  onView: (snapshot: InstructionSnapshot) => void;
  onClose: () => void;
}

export default function ViewHistoryModal({ history, currentTitle, currentStepCount, createdAt, onView, onClose }: ViewHistoryModalProps) {
  const entries = history.filter(e => !!e.snapshot);

  const versions: DisplayVersion[] = [];

  for (let i = 0; i < entries.length; i++) {
    versions.push({
      versionNum: i + 1,
      snapshot: entries[i].snapshot!,
      note: i === 0 ? undefined : entries[i - 1].note,
      updatedAt: i === 0 ? createdAt : entries[i - 1].updatedAt,
      updatedBy: i === 0 ? entries[i].snapshot!.createdBy : entries[i - 1].updatedBy,
      isCurrent: false,
      stepCount: entries[i].snapshot!.steps.length,
      title: entries[i].snapshot!.title,
    });
  }

  if (entries.length > 0) {
    const last = entries[entries.length - 1];
    versions.push({
      versionNum: entries.length + 1,
      note: last.note,
      updatedAt: last.updatedAt,
      updatedBy: last.updatedBy,
      isCurrent: true,
      stepCount: currentStepCount,
      title: currentTitle,
    });
  }

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
          {versions.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">過去のバージョンはありません。</p>
          ) : (
            [...versions].reverse().map((ver) => (
              <div key={ver.versionNum} className={`border rounded-lg p-3 ${ver.isCurrent ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-700">v{ver.versionNum}</span>
                    {ver.isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">最新</span>
                    )}
                    {ver.updatedAt && (
                      <span className="text-xs text-gray-400">
                        {new Date(ver.updatedAt).toLocaleString('ja-JP')}
                      </span>
                    )}
                    {ver.updatedBy && (
                      <span className="text-xs text-gray-500">{ver.updatedBy}</span>
                    )}
                  </div>
                  {!ver.isCurrent && ver.snapshot && (
                    <button
                      onClick={() => onView(ver.snapshot!)}
                      className="px-3 py-1 text-xs font-medium text-blue-600 border border-blue-300 rounded-lg hover:bg-blue-50 transition shrink-0"
                    >
                      閲覧
                    </button>
                  )}
                </div>
                {ver.note && (
                  <p className="text-xs text-gray-500 mt-1">{ver.note}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {ver.title} / {ver.stepCount}ステップ
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
