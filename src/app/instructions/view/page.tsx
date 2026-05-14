'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkInstruction, getCategoryLabel, getStepImages, getImageCaption } from '@/types/instruction';
import { getInstruction, deleteInstruction, importInstruction } from '@/lib/storage';
import { exportToPdf, buildPdfBuffer } from '@/lib/exportPdf';
import { exportToExcel, buildExcelBuffer } from '@/lib/exportSpreadsheet';
import { exportToWord } from '@/lib/exportWord';
import { generateShareUrl, parseShareData, getViewPageBaseUrl, ShareResult } from '@/lib/shareLink';
import ShareLinkModal from '@/components/ShareLinkModal';
import { saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState, addAuthListener, GoogleAuthState } from '@/lib/googleAuth';
import { getTempData } from '@/lib/tempStorage';

function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    let videoId: string | null = null;
    if (parsed.hostname.includes('youtube.com')) {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.slice(1);
    }
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
}

function InstructionViewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [instruction, setInstruction] = useState<WorkInstruction | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSharedView, setIsSharedView] = useState(false);
  const [isPreviewView, setIsPreviewView] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [driveSaving, setDriveSaving] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [checkStates, setCheckStates] = useState<Record<string, Record<string, boolean>>>({});

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
  }, []);

  useEffect(() => {
    if (!driveMessage) return;
    const timer = setTimeout(() => setDriveMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [driveMessage]);

  useEffect(() => {
    // Priority 1: shared data in hash fragment
    if (window.location.hash) {
      const shared = parseShareData(window.location.hash);
      if (shared) {
        setInstruction(shared);
        setIsSharedView(true);
        setLoading(false);
        return;
      }
    }

    // Priority 2: preview from IndexedDB
    if (searchParams.get('source') === 'preview') {
      getTempData('preview_instruction').then((raw) => {
        if (raw) {
          try {
            setInstruction(JSON.parse(raw) as WorkInstruction);
            setIsPreviewView(true);
          } catch { /* fall through */ }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
      return;
    }

    // Priority 3: load from localStorage by id
    const id = searchParams.get('id');
    if (id) {
      const data = getInstruction(id);
      setInstruction(data || null);
    }
    setLoading(false);
  }, [searchParams]);

  const handleDelete = () => {
    if (!instruction) return;
    if (!confirm(`「${instruction.title}」を削除しますか？`)) return;
    deleteInstruction(instruction.id);
    router.push('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (!instruction) return;
    const baseUrl = getViewPageBaseUrl();
    const result = generateShareUrl(instruction, baseUrl);
    setShareResult(result);
  };

  const handlePdfToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true);
    setDriveMessage(null);
    try {
      const buffer = await buildPdfBuffer(instruction);
      const fileName = `${instruction.title}.pdf`;
      await saveFileToDrive(buffer, fileName, 'application/pdf');
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      setDriveMessage({ text: `「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive PDF save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `Driveへの保存に失敗しました: ${msg}`, type: 'error' });
    } finally {
      setDriveSaving(false);
    }
  };

  const handlePdfExport = async () => {
    if (!instruction) return;
    setDriveMessage(null);
    try {
      await exportToPdf(instruction);
    } catch (err) {
      console.error('PDF export error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `PDF出力に失敗しました: ${msg}`, type: 'error' });
    }
  };

  const handleExcelToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true);
    try {
      const { buffer } = await buildExcelBuffer(instruction);
      const fileName = `${instruction.title}_手順書.xlsx`;
      await saveFileToDrive(
        buffer,
        fileName,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      setDriveMessage({ text: `「${folderName}」に保存しました`, type: 'success' });
    } catch (err) {
      console.error('Drive Excel save error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setDriveMessage({ text: `Driveへの保存に失敗しました: ${msg}`, type: 'error' });
    } finally {
      setDriveSaving(false);
    }
  };

  const handleImport = () => {
    if (!instruction) return;
    const newId = importInstruction(instruction);
    // Navigate to the local copy
    window.location.hash = '';
    router.push(`/instructions/view?id=${newId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (!instruction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-slate-500 text-lg">手順書が見つかりません</p>
        <Link href="/" className="text-blue-600 hover:text-blue-800">
          一覧に戻る
        </Link>
      </div>
    );
  }

  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Preview banner */}
      {isPreviewView && (
        <div className="bg-violet-50 border border-violet-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between no-print">
          <p className="text-sm text-violet-800">
            DriveのJSONファイルをプレビュー表示しています
          </p>
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-violet-600 text-white rounded text-sm hover:bg-violet-700 transition"
          >
            インポートして保存
          </button>
        </div>
      )}

      {/* Shared view banner */}
      {isSharedView && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between no-print">
          <p className="text-sm text-purple-800">
            共有された手順書を閲覧しています
          </p>
          <button
            onClick={handleImport}
            className="px-3 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 transition"
          >
            インポートして保存
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 no-print">
        <Link href="/" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          一覧に戻る
        </Link>
        <div className="flex-1" />
        {!isPreviewView && (
          <>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition"
            >
              印刷
            </button>
            <button
              onClick={handlePdfExport}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-600 rounded-lg text-sm hover:bg-rose-100 transition"
            >
              PDF出力
            </button>
            {isGoogleConfigured() && auth.isSignedIn && (
              <button
                onClick={handlePdfToDrive}
                disabled={driveSaving}
                className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition disabled:opacity-50"
              >
                {driveSaving ? '保存中...' : 'PDFをDriveに保存'}
              </button>
            )}
            <button
              onClick={() => exportToExcel(instruction)}
              className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg text-sm hover:bg-emerald-100 transition"
            >
              Excel出力
            </button>
            {isGoogleConfigured() && auth.isSignedIn && (
              <button
                onClick={handleExcelToDrive}
                disabled={driveSaving}
                className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition disabled:opacity-50"
              >
                {driveSaving ? '保存中...' : 'ExcelをDriveに保存'}
              </button>
            )}
            <button
              onClick={() => exportToWord(instruction)}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg text-sm hover:bg-blue-100 transition"
            >
              Word出力
            </button>
          </>
        )}
        {!isSharedView && !isPreviewView && (
          <>
            <button
              onClick={handleShare}
              className="px-3 py-1.5 bg-violet-50 border border-violet-200 text-violet-600 rounded-lg text-sm hover:bg-violet-100 transition"
            >
              共有リンク生成
            </button>
            <Link
              href={`/instructions/edit?id=${instruction.id}`}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm hover:from-blue-600 hover:to-indigo-600 transition shadow-sm"
            >
              編集
            </Link>
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition"
            >
              削除
            </button>
          </>
        )}
        {driveMessage && (
          <span className={`text-sm ${driveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {driveMessage.text}
          </span>
        )}
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{instruction.title}</h1>
          <span
            className={`shrink-0 text-sm px-3 py-1 rounded-full font-medium ${
              instruction.category === 'pc_work'
                ? 'bg-blue-50 text-blue-600'
                : 'bg-orange-50 text-orange-600'
            }`}
          >
            {getCategoryLabel(instruction.category)}
          </span>
        </div>
        {instruction.description && (
          <p className="text-slate-600 mb-4">{instruction.description}</p>
        )}
        <div className="text-xs text-slate-400 flex flex-wrap gap-4">
          <span>作成日: {new Date(instruction.createdAt).toLocaleDateString('ja-JP')}{instruction.createdBy ? ` (${instruction.createdBy})` : ''}</span>
          <span>更新日: {new Date(instruction.updatedAt).toLocaleDateString('ja-JP')}{instruction.updatedBy ? ` (${instruction.updatedBy})` : ''}</span>
          <span>{instruction.steps.length} ステップ</span>
        </div>
        {instruction.keywords && instruction.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {instruction.keywords.map((kw, i) => (
              <span
                key={i}
                className="inline-block text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full border border-slate-200"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {sortedSteps.map((step, index) => (
          <div
            key={step.id}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-lg font-bold text-sm shrink-0 shadow-sm">
                  {index + 1}
                </span>
                <h2 className="font-semibold text-slate-800">{step.title}</h2>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {step.description && (
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {step.description}
                </p>
              )}

              {getStepImages(step).map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="rounded-lg border border-slate-200 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`}
                    className="max-w-full h-auto mx-auto"
                  />
                  {getImageCaption(step, imgIdx) && (
                    <p className="px-3 py-2 text-sm text-slate-600 bg-slate-50 border-t border-slate-200">
                      {getImageCaption(step, imgIdx)}
                    </p>
                  )}
                </div>
              ))}

              {step.videoUrl && (
                <div>
                  {getYouTubeEmbedUrl(step.videoUrl) ? (
                    <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      <iframe
                        src={getYouTubeEmbedUrl(step.videoUrl)!}
                        title={`ステップ ${index + 1} の動画`}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <a
                      href={step.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      動画を再生
                    </a>
                  )}
                </div>
              )}

              {step.caution && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                  <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    注意: {step.caution}
                  </p>
                </div>
              )}

              {step.checkItems && step.checkItems.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 space-y-2">
                  <p className="text-xs font-medium text-blue-700 mb-1">チェック項目</p>
                  {step.checkItems.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={checkStates[step.id]?.[item.id] ?? false}
                        onChange={(e) => {
                          setCheckStates(prev => ({
                            ...prev,
                            [step.id]: {
                              ...(prev[step.id] ?? {}),
                              [item.id]: e.target.checked,
                            },
                          }));
                        }}
                        className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-sm ${checkStates[step.id]?.[item.id] ? 'text-blue-400 line-through' : 'text-blue-800'}`}>
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Share Link Modal */}
      {shareResult && (
        <ShareLinkModal
          url={shareResult.url}
          imagesIncluded={shareResult.imagesIncluded}
          onClose={() => setShareResult(null)}
        />
      )}
    </div>
  );
}

export default function InstructionViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><p className="text-slate-500">読み込み中...</p></div>}>
      <InstructionViewContent />
    </Suspense>
  );
}
