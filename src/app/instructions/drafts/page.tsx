'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkInstruction, getCategoryLabel } from '@/types/instruction';
import { getAllInstructions, deleteInstruction } from '@/lib/storage';
import { setTempData } from '@/lib/tempStorage';

export default function DraftsPage() {
  const router = useRouter();
  const [drafts, setDrafts] = useState<WorkInstruction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const all = getAllInstructions();
    // Show drafts (status === 'draft' or status is undefined for legacy data)
    const draftList = all
      .filter((inst) => !inst.status || inst.status === 'draft')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    setDrafts(draftList);
  }, []);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`「${title}」を削除しますか？`)) return;
    deleteInstruction(id);
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const handleDeleteAll = () => {
    if (!confirm(`下書き ${drafts.length} 件をすべて削除しますか？\nブラウザの保存容量が解放されます。`)) return;
    drafts.forEach((d) => deleteInstruction(d.id));
    setDrafts([]);
  };

  const handleJsonFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as WorkInstruction;
        if (!json.id || !json.title || !Array.isArray(json.steps)) {
          alert('有効な手順書JSONファイルではありません。');
          return;
        }
        await setTempData('drive_import_instruction', JSON.stringify(json));
        router.push('/instructions/edit?source=drive');
      } catch {
        alert('JSONファイルの読み込みに失敗しました。ファイルが壊れている可能性があります。');
      }
    };
    reader.readAsText(file);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleJsonFileChange}
      />
      <div className="flex items-center gap-3 mb-8">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          戻る
        </Link>
        <h1 className="text-2xl font-bold text-slate-800">途中から編集</h1>
        <span className="text-sm text-slate-400 ml-1">{drafts.length} 件</span>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="ml-auto text-xs px-3 py-1.5 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
        >
          JSONから読み込む
        </button>
        {drafts.length >= 2 && (
          <button
            onClick={handleDeleteAll}
            className="text-xs px-3 py-1.5 text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            すべて削除
          </button>
        )}
      </div>

      {drafts.length === 0 ? (
        <div className="text-center py-20">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 rounded-2xl mb-5">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 text-lg mb-2">下書きがありません</p>
          <p className="text-slate-400 text-sm mb-6">新規作成で手順書を作り始めましょう</p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/instructions/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-600 transition shadow-md"
            >
              新規作成
            </Link>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-sm px-5 py-2.5 text-blue-600 border border-blue-200 rounded-xl hover:bg-blue-50 transition"
            >
              JSONから読み込む
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {drafts.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden"
            >
              <div className="flex items-center gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="font-semibold text-slate-800 truncate">{inst.title || '無題の手順書'}</h2>
                    <span
                      className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                        inst.category === 'pc_work'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-orange-50 text-orange-600'
                      }`}
                    >
                      {getCategoryLabel(inst.category)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{inst.steps.length} ステップ</span>
                    <span>最終更新: {new Date(inst.updatedAt).toLocaleString('ja-JP')}</span>
                    {inst.createdBy && <span>作成者: {inst.createdBy}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/instructions/edit?id=${inst.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-600 transition shadow-sm"
                  >
                    編集を再開
                  </Link>
                  <button
                    onClick={() => handleDelete(inst.id, inst.title)}
                    className="px-3 py-2 text-sm text-slate-400 hover:text-red-600 transition"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
