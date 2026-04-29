'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkInstruction } from '@/types/instruction';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';
import DriveJsonFilePicker from '@/components/DriveJsonFilePicker';
import { setTempData } from '@/lib/tempStorage';

export default function HomePage() {
  const router = useRouter();
  const [importError, setImportError] = useState<string | null>(null);
  const [showJsonPicker, setShowJsonPicker] = useState(false);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);

  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(timer);
  }, [importError]);

  const handleUpdateClick = () => {
    const auth = getAuthState();
    if (isGoogleConfigured() && auth.isSignedIn) {
      setShowJsonPicker(true);
    } else {
      setImportError('Googleドライブに接続してください。右上のサインインボタンからログインできます。');
    }
  };

  const handlePreviewClick = () => {
    const auth = getAuthState();
    if (isGoogleConfigured() && auth.isSignedIn) {
      setShowPreviewPicker(true);
    } else {
      setImportError('Googleドライブに接続してください。右上のサインインボタンからログインできます。');
    }
  };

  const handlePreviewFileLoaded = async (content: string, fileName: string) => {
    try {
      const json = JSON.parse(content);
      if (!json.id || !json.title || !json.steps || !Array.isArray(json.steps)) {
        throw new Error('無効な手順書データです。');
      }
      await setTempData('preview_instruction', JSON.stringify(json));
      router.push('/instructions/view?source=preview');
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : `${fileName}の読み込みに失敗しました。`
      );
    }
  };

  const handleJsonFileLoaded = async (content: string, fileName: string) => {
    try {
      const json = JSON.parse(content);
      if (!json.id || !json.title || !json.steps || !Array.isArray(json.steps)) {
        throw new Error('無効な手順書データです。');
      }
      const instruction = json as WorkInstruction;
      instruction.status = 'completed';
      await setTempData('drive_import_instruction', JSON.stringify(instruction));
      router.push('/instructions/edit?source=drive');
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : `${fileName}の読み込みに失敗しました。`
      );
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-5 shadow-lg">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight mb-2">手順書作成システム</h1>
        <p className="text-slate-500">作業手順書の作成・更新を行います</p>
      </div>

      {/* 3 workflow buttons */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* 新規作成 */}
        <Link
          href="/instructions/new"
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-blue-400 p-8 text-center transition-all duration-200 hover:shadow-xl"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-50 group-hover:bg-blue-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">新規作成</h2>
          <p className="text-sm text-slate-500">1から手順書を作成します</p>
        </Link>

        {/* 途中から編集 */}
        <Link
          href="/instructions/drafts"
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400 p-8 text-center transition-all duration-200 hover:shadow-xl"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-50 group-hover:bg-amber-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">途中から編集</h2>
          <p className="text-sm text-slate-500">下書きの編集を再開</p>
        </Link>

        {/* 手順書更新 */}
        <button
          type="button"
          onClick={handleUpdateClick}
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-emerald-400 p-8 text-center transition-all duration-200 hover:shadow-xl cursor-pointer"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 group-hover:bg-emerald-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">手順書更新</h2>
          <p className="text-sm text-slate-500">DriveのJSONを読み込んで更新</p>
        </button>

        {/* 手順書確認 */}
        <button
          type="button"
          onClick={handlePreviewClick}
          className="group relative bg-white rounded-2xl border-2 border-slate-200 hover:border-violet-400 p-8 text-center transition-all duration-200 hover:shadow-xl cursor-pointer"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-50 group-hover:bg-violet-100 rounded-xl mb-4 transition">
            <svg className="w-7 h-7 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">手順書確認</h2>
          <p className="text-sm text-slate-500">DriveのJSONをプレビュー表示</p>
        </button>
      </div>

      {/* Error message */}
      {importError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {importError}
        </div>
      )}

      {/* Drive JSON File Picker */}
      <DriveJsonFilePicker
        open={showJsonPicker}
        onClose={() => setShowJsonPicker(false)}
        onFileLoaded={handleJsonFileLoaded}
      />

      {/* Preview JSON File Picker */}
      <DriveJsonFilePicker
        open={showPreviewPicker}
        onClose={() => setShowPreviewPicker(false)}
        onFileLoaded={handlePreviewFileLoaded}
      />
    </div>
  );
}
