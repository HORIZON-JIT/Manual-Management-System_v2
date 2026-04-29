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
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero section */}
      <div className="text-center mb-14">
        <h1 className="text-4xl font-bold text-[#1d1d1f] tracking-tight mb-3">手順書作成システム</h1>
        <p className="text-[#6e6e73] text-lg">作業手順書の作成・更新・管理を行います</p>
      </div>

      {/* Workflow cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {/* 新規作成 */}
        <Link
          href="/instructions/new"
          className="group bg-white rounded-2xl border border-[#e8e8ed] hover:shadow-lg p-7 flex flex-col items-center text-center transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-4 group-hover:bg-[#e8e8ed] transition-colors">
            <svg className="w-6 h-6 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">新規作成</h2>
          <p className="text-sm text-[#6e6e73]">1から手順書を作成します</p>
          <span className="mt-4 text-xs text-[#0071e3] group-hover:underline">開く →</span>
        </Link>

        {/* 途中から編集 */}
        <Link
          href="/instructions/drafts"
          className="group bg-white rounded-2xl border border-[#e8e8ed] hover:shadow-lg p-7 flex flex-col items-center text-center transition-all duration-200"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-4 group-hover:bg-[#e8e8ed] transition-colors">
            <svg className="w-6 h-6 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">途中から編集</h2>
          <p className="text-sm text-[#6e6e73]">下書きの編集を再開</p>
          <span className="mt-4 text-xs text-[#0071e3] group-hover:underline">開く →</span>
        </Link>

        {/* 手順書更新 */}
        <button
          type="button"
          onClick={handleUpdateClick}
          className="group bg-white rounded-2xl border border-[#e8e8ed] hover:shadow-lg p-7 flex flex-col items-center text-center transition-all duration-200 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-4 group-hover:bg-[#e8e8ed] transition-colors">
            <svg className="w-6 h-6 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">手順書更新</h2>
          <p className="text-sm text-[#6e6e73]">DriveのJSONを読み込んで更新</p>
          <span className="mt-4 text-xs text-[#0071e3] group-hover:underline">開く →</span>
        </button>

        {/* 手順書確認 */}
        <button
          type="button"
          onClick={handlePreviewClick}
          className="group bg-white rounded-2xl border border-[#e8e8ed] hover:shadow-lg p-7 flex flex-col items-center text-center transition-all duration-200 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-xl bg-[#f5f5f7] flex items-center justify-center mb-4 group-hover:bg-[#e8e8ed] transition-colors">
            <svg className="w-6 h-6 text-[#0071e3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-[#1d1d1f] mb-1">手順書確認</h2>
          <p className="text-sm text-[#6e6e73]">DriveのJSONをプレビュー表示</p>
          <span className="mt-4 text-xs text-[#0071e3] group-hover:underline">開く →</span>
        </button>
      </div>

      {/* Error message */}
      {importError && (
        <div className="mb-6 p-4 bg-[#fff2f2] border border-[#ff3b30]/30 rounded-2xl text-sm text-[#c00]">
          {importError}
        </div>
      )}

      <DriveJsonFilePicker
        open={showJsonPicker}
        onClose={() => setShowJsonPicker(false)}
        onFileLoaded={handleJsonFileLoaded}
      />
      <DriveJsonFilePicker
        open={showPreviewPicker}
        onClose={() => setShowPreviewPicker(false)}
        onFileLoaded={handlePreviewFileLoaded}
      />
    </div>
  );
}
