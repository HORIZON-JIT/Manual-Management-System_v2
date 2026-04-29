'use client';

import { useState, useEffect } from 'react';
import { DriveFileInfo, getTargetFolder, listJsonFilesInFolder, downloadDriveFile } from '@/lib/googleDrive';

interface DriveJsonFilePickerProps {
  open: boolean;
  onClose: () => void;
  onFileLoaded: (content: string, fileName: string) => void;
}

export default function DriveJsonFilePicker({ open, onClose, onFileLoaded }: DriveJsonFilePickerProps) {
  const [files, setFiles] = useState<DriveFileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    const folder = getTargetFolder();
    if (!folder) {
      setError('Driveフォルダが指定されていません。ヘッダーのフォルダボタンから設定してください。');
      setFolderName(''); setFiles([]); return;
    }
    setFolderName(folder.name); setError(null); setLoading(true);
    listJsonFilesInFolder(folder.id)
      .then((jsonFiles) => { setFiles(jsonFiles); if (jsonFiles.length === 0) setError('このフォルダにJSONファイルがありません'); })
      .catch(() => setError('ファイル一覧の取得に失敗しました'))
      .finally(() => setLoading(false));
  }, [open]);

  const handleFileSelect = async (file: DriveFileInfo) => {
    setDownloading(file.id); setError(null);
    try { const content = await downloadDriveFile(file.id); handleClose(); onFileLoaded(content, file.name); }
    catch { setError('ファイルのダウンロードに失敗しました'); }
    finally { setDownloading(null); }
  };

  const handleClose = () => { setFiles([]); setError(null); setDownloading(null); onClose(); };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8e8ed]">
          <h3 className="text-base font-semibold text-[#1d1d1f]">JSONファイルを選択</h3>
          {folderName && (
            <p className="text-xs text-[#86868b] mt-0.5">
              フォルダ: <span className="font-medium text-[#1d1d1f]">{folderName}</span>
            </p>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#86868b] text-sm">読み込み中...</div>
          ) : files.length === 0 && !error ? (
            <div className="flex items-center justify-center h-32 text-[#86868b] text-sm">JSONファイルがありません</div>
          ) : (
            <ul className="space-y-0.5">
              {files.map((file) => (
                <li key={file.id}>
                  <button onClick={() => handleFileSelect(file)} disabled={downloading !== null}
                    className="w-full text-left px-3 py-3 rounded-xl hover:bg-[#f5f5f7] flex items-center gap-3 text-sm transition disabled:opacity-50">
                    <span className="text-[#0071e3] text-base shrink-0 font-mono">
                      {downloading === file.id ? (
                        <span className="inline-block w-4 h-4 border-2 border-[#d2d2d7] border-t-[#0071e3] rounded-full animate-spin" />
                      ) : '{ }'}
                    </span>
                    <span className="text-[#1d1d1f] truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <div className="px-4 py-2 text-sm text-[#ff3b30] text-center">{error}</div>}

        {/* Actions */}
        <div className="px-4 py-3.5 border-t border-[#e8e8ed] flex justify-end">
          <button onClick={handleClose}
            className="px-5 py-2 text-sm text-[#6e6e73] hover:text-[#1d1d1f] border border-[#d2d2d7] rounded-full transition">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
