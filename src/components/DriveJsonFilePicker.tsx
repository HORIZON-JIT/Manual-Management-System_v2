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
      setFolderName('');
      setFiles([]);
      return;
    }
    setFolderName(folder.name);
    setError(null);
    setLoading(true);
    listJsonFilesInFolder(folder.id)
      .then((jsonFiles) => {
        setFiles(jsonFiles);
        if (jsonFiles.length === 0) {
          setError('このフォルダにJSONファイルがありません');
        }
      })
      .catch((err) => {
        console.error('Failed to list files:', err);
        setError('ファイル一覧の取得に失敗しました');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const handleFileSelect = async (file: DriveFileInfo) => {
    setDownloading(file.id);
    setError(null);
    try {
      const content = await downloadDriveFile(file.id);
      handleClose();
      onFileLoaded(content, file.name);
    } catch (err) {
      console.error('Failed to download file:', err);
      setError('ファイルのダウンロードに失敗しました');
    } finally {
      setDownloading(null);
    }
  };

  const handleClose = () => {
    setFiles([]);
    setError(null);
    setDownloading(null);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-800">JSONファイルを選択</h3>
          {folderName && (
            <p className="text-xs text-gray-500 mt-1">
              フォルダ: <span className="font-medium text-emerald-700">{folderName}</span>
            </p>
          )}
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              読み込み中...
            </div>
          ) : files.length === 0 && !error ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              JSONファイルがありません
            </div>
          ) : (
            <ul className="space-y-1">
              {files.map((file) => (
                <li key={file.id}>
                  <button
                    onClick={() => handleFileSelect(file)}
                    disabled={downloading !== null}
                    className="w-full text-left px-3 py-3 rounded-lg hover:bg-emerald-50 flex items-center gap-3 text-sm transition disabled:opacity-50"
                  >
                    <span className="text-emerald-500 text-lg shrink-0">
                      {downloading === file.id ? (
                        <span className="inline-block w-5 h-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
                      ) : (
                        '{ }'
                      )}
                    </span>
                    <span className="text-gray-700 truncate">{file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-2 text-sm text-red-600 text-center">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition"
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
