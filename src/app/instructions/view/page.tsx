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
    if (parsed.hostname.includes('youtube.com')) videoId = parsed.searchParams.get('v');
    else if (parsed.hostname === 'youtu.be') videoId = parsed.pathname.slice(1);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch { return null; }
}

const btnCls = 'px-3 py-1.5 border border-[#d2d2d7] text-[#1d1d1f] rounded-full text-sm hover:bg-[#f5f5f7] transition';

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
    if (window.location.hash) {
      const shared = parseShareData(window.location.hash);
      if (shared) { setInstruction(shared); setIsSharedView(true); setLoading(false); return; }
    }
    if (searchParams.get('source') === 'preview') {
      getTempData('preview_instruction').then((raw) => {
        if (raw) { try { setInstruction(JSON.parse(raw) as WorkInstruction); setIsPreviewView(true); } catch { /* fall through */ } }
        setLoading(false);
      }).catch(() => setLoading(false));
      return;
    }
    const id = searchParams.get('id');
    if (id) setInstruction(getInstruction(id) || null);
    setLoading(false);
  }, [searchParams]);

  const handleDelete = () => {
    if (!instruction) return;
    if (!confirm(`「${instruction.title}」を削除しますか？`)) return;
    deleteInstruction(instruction.id); router.push('/');
  };

  const handleShare = () => {
    if (!instruction) return;
    setShareResult(generateShareUrl(instruction, getViewPageBaseUrl()));
  };

  const handlePdfToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true); setDriveMessage(null);
    try {
      const buffer = await buildPdfBuffer(instruction);
      await saveFileToDrive(buffer, `${instruction.title}.pdf`, 'application/pdf');
      setDriveMessage({ text: `「${getTargetFolder()?.name || 'Drive'}」に保存しました`, type: 'success' });
    } catch (err) {
      setDriveMessage({ text: `保存に失敗: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    } finally { setDriveSaving(false); }
  };

  const handlePdfExport = async () => {
    if (!instruction) return;
    try { await exportToPdf(instruction); }
    catch (err) { setDriveMessage({ text: `PDF出力に失敗: ${err instanceof Error ? err.message : String(err)}`, type: 'error' }); }
  };

  const handleExcelToDrive = async () => {
    if (!instruction) return;
    setDriveSaving(true);
    try {
      const { buffer } = await buildExcelBuffer(instruction);
      await saveFileToDrive(buffer, `${instruction.title}_手順書.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      setDriveMessage({ text: `「${getTargetFolder()?.name || 'Drive'}」に保存しました`, type: 'success' });
    } catch (err) {
      setDriveMessage({ text: `保存に失敗: ${err instanceof Error ? err.message : String(err)}`, type: 'error' });
    } finally { setDriveSaving(false); }
  };

  const handleImport = () => {
    if (!instruction) return;
    const newId = importInstruction(instruction);
    window.location.hash = '';
    router.push(`/instructions/view?id=${newId}`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-[#6e6e73]">読み込み中...</p>
    </div>
  );

  if (!instruction) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
      <p className="text-[#6e6e73] text-lg">手順書が見つかりません</p>
      <Link href="/" className="text-[#0071e3] hover:opacity-70 transition text-sm">一覧に戻る</Link>
    </div>
  );

  const sortedSteps = [...instruction.steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Preview banner */}
      {isPreviewView && (
        <div className="bg-[#f0f4ff] border border-[#b3c4f5] rounded-2xl px-4 py-3 mb-4 flex items-center justify-between no-print">
          <p className="text-sm text-[#1d3a8a]">DriveのJSONファイルをプレビュー表示しています</p>
          <button onClick={handleImport}
            className="px-4 py-1.5 bg-[#0071e3] text-white rounded-full text-sm hover:bg-[#0077ed] transition">
            インポートして保存
          </button>
        </div>
      )}

      {/* Shared view banner */}
      {isSharedView && (
        <div className="bg-[#f0f4ff] border border-[#b3c4f5] rounded-2xl px-4 py-3 mb-4 flex items-center justify-between no-print">
          <p className="text-sm text-[#1d3a8a]">共有された手順書を閲覧しています</p>
          <button onClick={handleImport}
            className="px-4 py-1.5 bg-[#0071e3] text-white rounded-full text-sm hover:bg-[#0077ed] transition">
            インポートして保存
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-2 mb-6 no-print">
        <Link href="/" className="text-sm text-[#6e6e73] hover:text-[#1d1d1f] flex items-center gap-1 transition">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          一覧に戻る
        </Link>
        <div className="flex-1" />
        {!isPreviewView && (
          <>
            <button onClick={window.print.bind(window)} className={btnCls}>印刷</button>
            <button onClick={handlePdfExport} className={btnCls}>PDF出力</button>
            {isGoogleConfigured() && auth.isSignedIn && (
              <button onClick={handlePdfToDrive} disabled={driveSaving} className={`${btnCls} disabled:opacity-50`}>
                {driveSaving ? '保存中...' : 'PDFをDriveに保存'}
              </button>
            )}
            <button onClick={() => exportToExcel(instruction)} className={btnCls}>Excel出力</button>
            {isGoogleConfigured() && auth.isSignedIn && (
              <button onClick={handleExcelToDrive} disabled={driveSaving} className={`${btnCls} disabled:opacity-50`}>
                {driveSaving ? '保存中...' : 'ExcelをDriveに保存'}
              </button>
            )}
            <button onClick={() => exportToWord(instruction)} className={btnCls}>Word出力</button>
          </>
        )}
        {!isSharedView && !isPreviewView && (
          <>
            <button onClick={handleShare} className={btnCls}>共有リンク生成</button>
            <Link href={`/instructions/edit?id=${instruction.id}`}
              className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full text-sm transition">
              編集
            </Link>
            <button onClick={handleDelete}
              className="px-3 py-1.5 text-[#ff3b30] hover:bg-[#fff2f2] rounded-full text-sm border border-[#d2d2d7] transition">
              削除
            </button>
          </>
        )}
        {driveMessage && (
          <span className={`text-sm ${driveMessage.type === 'success' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
            {driveMessage.text}
          </span>
        )}
      </div>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-[#e8e8ed] p-6 mb-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">{instruction.title}</h1>
          <span className="shrink-0 text-sm px-3 py-1 rounded-full font-medium bg-[#f5f5f7] text-[#6e6e73]">
            {getCategoryLabel(instruction.category)}
          </span>
        </div>
        {instruction.description && (
          <p className="text-[#6e6e73] mb-4">{instruction.description}</p>
        )}
        <div className="text-xs text-[#86868b] flex flex-wrap gap-4">
          <span>作成日: {new Date(instruction.createdAt).toLocaleDateString('ja-JP')}{instruction.createdBy ? ` (${instruction.createdBy})` : ''}</span>
          <span>更新日: {new Date(instruction.updatedAt).toLocaleDateString('ja-JP')}{instruction.updatedBy ? ` (${instruction.updatedBy})` : ''}</span>
          <span>{instruction.steps.length} ステップ</span>
        </div>
        {instruction.keywords && instruction.keywords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {instruction.keywords.map((kw, i) => (
              <span key={i} className="inline-block text-xs px-2.5 py-1 bg-[#f5f5f7] text-[#6e6e73] rounded-full border border-[#e8e8ed]">
                {kw}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {sortedSteps.map((step, index) => (
          <div key={step.id} className="bg-white rounded-2xl border border-[#e8e8ed] overflow-hidden">
            <div className="bg-[#f5f5f7] px-5 py-3.5 border-b border-[#e8e8ed]">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-7 h-7 bg-[#0071e3] text-white rounded-lg font-bold text-xs shrink-0">
                  {index + 1}
                </span>
                <h2 className="font-semibold text-[#1d1d1f]">{step.title}</h2>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {step.description && (
                <p className="text-[#1d1d1f] whitespace-pre-wrap leading-relaxed">{step.description}</p>
              )}

              {getStepImages(step).map((imgUrl, imgIdx) => (
                <div key={imgIdx} className="rounded-xl border border-[#e8e8ed] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imgUrl} alt={`ステップ ${index + 1} の画像 ${imgIdx + 1}`} className="max-w-full h-auto mx-auto" />
                  {getImageCaption(step, imgIdx) && (
                    <p className="px-3 py-2 text-sm text-[#6e6e73] bg-[#f5f5f7] border-t border-[#e8e8ed]">
                      {getImageCaption(step, imgIdx)}
                    </p>
                  )}
                </div>
              ))}

              {step.videoUrl && (
                <div>
                  {getYouTubeEmbedUrl(step.videoUrl) ? (
                    <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
                      <iframe src={getYouTubeEmbedUrl(step.videoUrl)!} title={`ステップ ${index + 1} の動画`}
                        className="absolute inset-0 w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    </div>
                  ) : (
                    <a href={step.videoUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[#0071e3] hover:opacity-70 text-sm transition">
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
                <div className="bg-[#fff8ec] border border-[#ff9f0a]/40 rounded-xl px-4 py-3">
                  <p className="text-sm text-[#4a2600] font-medium flex items-center gap-1.5">
                    <svg className="w-4 h-4 shrink-0 text-[#ff9f0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    注意: {step.caution}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {shareResult && (
        <ShareLinkModal url={shareResult.url} imagesIncluded={shareResult.imagesIncluded} onClose={() => setShareResult(null)} />
      )}
    </div>
  );
}

export default function InstructionViewPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><p className="text-[#6e6e73]">読み込み中...</p></div>}>
      <InstructionViewContent />
    </Suspense>
  );
}
