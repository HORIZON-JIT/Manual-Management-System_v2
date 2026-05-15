'use client';

import { useEffect, useState, Suspense, Fragment } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkInstruction, getCategoryLabel, getStepImages, getImageCaption } from '@/types/instruction';
import { getInstruction, importInstruction } from '@/lib/storage';
import { parseShareData } from '@/lib/shareLink';
import { downloadDriveFile } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState, addAuthListener, GoogleAuthState, signIn, initGoogleAuth } from '@/lib/googleAuth';
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
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [checkStates, setCheckStates] = useState<Record<string, Record<string, boolean>>>({});
  const [selectedConditions, setSelectedConditions] = useState<Record<string, string | null>>({});
  const [revealedCount, setRevealedCount] = useState(1);

  useEffect(() => {
    if (!isGoogleConfigured()) return;
    return addAuthListener(setAuth);
  }, []);

  useEffect(() => {
    setCheckStates({});

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

    // Priority 3: load from Drive by driveFileId
    const driveFileId = searchParams.get('driveFileId');
    if (driveFileId) {
      initGoogleAuth().then(() => {
        const state = getAuthState();
        if (!state.isSignedIn) {
          setLoading(false);
          return;
        }
        return downloadDriveFile(driveFileId)
          .then((text) => {
            const data = JSON.parse(text) as WorkInstruction;
            setInstruction(data);
          })
          .catch(() => setInstruction(null));
      }).finally(() => setLoading(false));
      return;
    }

    // Priority 4: load from localStorage by id
    const id = searchParams.get('id');
    if (id) {
      const data = getInstruction(id);
      setInstruction(data || null);
    }
    setLoading(false);
  }, [searchParams, auth.isSignedIn]);

  const handlePrint = () => {
    window.print();
  };

  const handleImport = () => {
    if (!instruction) return;
    const newId = importInstruction(instruction);
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
    const driveFileId = searchParams.get('driveFileId');
    if (driveFileId && !auth.isSignedIn) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 px-4">
          <p className="text-slate-700 text-base font-medium">この手順書を閲覧するにはGoogleログインが必要です</p>
          {isGoogleConfigured() && (
            <button
              onClick={() => signIn()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition"
            >
              Googleでログイン
            </button>
          )}
          <Link href="/" className="text-sm text-blue-600 hover:text-blue-800">
            一覧に戻る
          </Link>
        </div>
      );
    }
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
  const hasConditions = instruction.conditions && instruction.conditions.length > 0;

  const condGroupMap = new Map<string, string>();
  const groupConditions = new Map<string, typeof instruction.conditions>();
  if (hasConditions && instruction.conditions) {
    for (const c of instruction.conditions) {
      const g = c.group || '__default';
      condGroupMap.set(c.id, g);
      if (!groupConditions.has(g)) groupConditions.set(g, []);
      groupConditions.get(g)!.push(c);
    }
  }
  const getStepGroup = (s: { conditionId?: string }) =>
    s.conditionId ? condGroupMap.get(s.conditionId) : undefined;

  const groupMetaMap = new Map<string, { parentConditionId?: string }>();
  for (const g of instruction.conditionGroups ?? []) {
    groupMetaMap.set(g.id, g);
  }
  const isGroupVisible = (groupId: string, visited = new Set<string>()): boolean => {
    if (visited.has(groupId)) return true;
    visited.add(groupId);
    const meta = groupMetaMap.get(groupId);
    if (!meta?.parentConditionId) return true;
    const parentGroup = condGroupMap.get(meta.parentConditionId);
    if (!parentGroup) return true;
    if (!isGroupVisible(parentGroup, visited)) return false;
    const parentSel = selectedConditions[parentGroup];
    return parentSel === null || parentSel === undefined || parentSel === meta.parentConditionId;
  };

  const visibleSteps = hasConditions
    ? sortedSteps.filter(s => {
        const group = getStepGroup(s);
        if (!group) return true;
        if (!isGroupVisible(group)) return false;
        const sel = selectedConditions[group];
        if (sel === undefined || sel === null) return true;
        return s.conditionId === sel;
      })
    : sortedSteps;

  const stepNumbers: number[] = [];
  {
    let logicalNum = 0;
    const seenGroups = new Set<string>();
    for (const s of visibleSteps) {
      const group = getStepGroup(s);
      if (group) {
        if (!seenGroups.has(group)) {
          logicalNum++;
          seenGroups.add(group);
        }
      } else {
        logicalNum++;
      }
      stepNumbers.push(logicalNum);
    }
  }

  const isSequential = !!instruction.sequential;

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
          </>
        )}
        {!isSharedView && !isPreviewView && (
          <>
            <Link
              href={`/instructions/edit?id=${instruction.id}`}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-sm hover:from-blue-600 hover:to-indigo-600 transition shadow-sm"
            >
              編集
            </Link>
          </>
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
        {(isSequential ? visibleSteps.slice(0, revealedCount) : visibleSteps).map((step, index) => {
          const prevStep = index > 0 ? visibleSteps[index - 1] : null;
          const group = getStepGroup(step);
          const prevGroup = prevStep ? getStepGroup(prevStep) : undefined;
          const showInlineTabs = hasConditions && !!group && group !== prevGroup;
          const zoneConds = group ? groupConditions.get(group) ?? [] : [];
          const zoneSel = group ? (selectedConditions[group] ?? null) : null;
          const isLastRevealed = isSequential && index === Math.min(revealedCount, visibleSteps.length) - 1;

          return (
          <Fragment key={step.id}>
            {showInlineTabs && group && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3 no-print">
                <p className="text-xs text-slate-500 mb-2 font-medium">▼ 条件で表示を切り替え</p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => { setSelectedConditions(prev => ({ ...prev, [group]: null })); setRevealedCount(1); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                      zoneSel === null
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    すべて表示
                  </button>
                  {zoneConds.map((cond) => (
                    <button
                      key={cond.id}
                      onClick={() => { setSelectedConditions(prev => ({ ...prev, [group]: cond.id })); setRevealedCount(1); }}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                        zoneSel === cond.id
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div
              className="bg-white rounded-xl border border-slate-200 overflow-hidden"
            >
            <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 px-5 py-3.5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-lg font-bold text-sm shrink-0 shadow-sm">
                  {stepNumbers[index]}
                </span>
                <h2 className="font-semibold text-slate-800 flex-1">{step.title}</h2>
                {zoneSel === null && step.conditionId && instruction.conditions && (
                  <span className="shrink-0 text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full border border-orange-200">
                    {instruction.conditions.find(c => c.id === step.conditionId)?.label}
                  </span>
                )}
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
                    alt={`ステップ ${stepNumbers[index]} の画像 ${imgIdx + 1}`}
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
                        title={`ステップ ${stepNumbers[index]} の動画`}
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
                      <span
                        className="text-sm text-blue-800"
                        style={checkStates[step.id]?.[item.id] ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
                      >
                        {item.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            </div>
            {isLastRevealed && (
              <div className="flex items-center justify-between no-print">
                <span className="text-sm text-slate-500">
                  {stepNumbers[index]} / {stepNumbers[visibleSteps.length - 1]} ステップ
                </span>
                {revealedCount < visibleSteps.length ? (
                  <button
                    onClick={() => setRevealedCount(c => c + 1)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition"
                  >
                    次へ →
                  </button>
                ) : (
                  <span className="px-6 py-2.5 bg-emerald-100 text-emerald-700 font-bold rounded-xl">
                    完了 ✓
                  </span>
                )}
              </div>
            )}
          </Fragment>
          );
        })}
      </div>

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
