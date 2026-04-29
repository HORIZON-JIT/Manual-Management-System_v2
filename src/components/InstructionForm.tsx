'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import { WorkInstruction, Step, DEFAULT_CATEGORIES, UpdateHistoryEntry, InstructionStatus } from '@/types/instruction';
import { saveInstruction } from '@/lib/storage';
import { buildExcelBuffer, ExcelNavMode } from '@/lib/exportSpreadsheet';
import { uploadAsGoogleSheet } from '@/lib/googleDrive';
import { addStepNavLinks } from '@/lib/sheetsNavLinks';
import { saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';
import StepEditor from './StepEditor';

const LAST_AUTHOR_KEY = 'last_author_name';

interface InstructionFormProps {
  initialData?: WorkInstruction;
}

function createEmptyStep(orderIndex: number): Step {
  return { id: uuidv4(), orderIndex, title: '', description: '' };
}

function getLastAuthorName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(LAST_AUTHOR_KEY) || '';
}

function saveLastAuthorName(name: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LAST_AUTHOR_KEY, name);
  }
}

const inputCls = 'w-full border border-[#d2d2d7] rounded-xl px-3 py-2 text-[#1d1d1f] placeholder:text-[#86868b] focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none bg-white transition';
const labelCls = 'block text-sm font-medium text-[#1d1d1f] mb-1.5';

export default function InstructionForm({ initialData }: InstructionFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState(initialData?.category || DEFAULT_CATEGORIES[0]);
  const [showCustomCategory, setShowCustomCategory] = useState(
    !!initialData?.category && !DEFAULT_CATEGORIES.includes(initialData.category as typeof DEFAULT_CATEGORIES[number])
  );
  const [customCategory, setCustomCategory] = useState(
    initialData?.category && !DEFAULT_CATEGORIES.includes(initialData.category as typeof DEFAULT_CATEGORIES[number])
      ? initialData.category : ''
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps?.length ? initialData.steps : [createEmptyStep(0)]
  );
  const [authorName, setAuthorName] = useState(
    initialData?.updatedBy || initialData?.createdBy || getLastAuthorName()
  );
  const [updateNote, setUpdateNote] = useState('');
  const [addHistory, setAddHistory] = useState(false);
  const [keywordsText, setKeywordsText] = useState(initialData?.keywords?.join(', ') || '');
  const [excelNavMode, setExcelNavMode] = useState<ExcelNavMode>('jump');

  const handleAddStep = () => setSteps([...steps, createEmptyStep(steps.length)]);

  const handleStepChange = (index: number, updatedStep: Step) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) { alert('最低1つのステップが必要です。'); return; }
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, orderIndex: i })));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, orderIndex: i })));
  };

  const buildInstruction = (status: InstructionStatus): WorkInstruction | null => {
    if (!title.trim()) { alert('タイトルを入力してください。'); return null; }
    if (status === 'completed') {
      if (steps.some((s) => !s.title.trim())) { alert('すべてのステップにタイトルを入力してください。'); return null; }
      if (!authorName.trim()) { alert(isEdit ? '更新者名を入力してください。' : '作成者名を入力してください。'); return null; }
    }
    const trimmedName = authorName.trim();
    if (trimmedName) saveLastAuthorName(trimmedName);
    const now = new Date().toISOString();
    let updateHistory: UpdateHistoryEntry[] = initialData?.updateHistory || [];
    if (isEdit && trimmedName && addHistory) {
      const entry: UpdateHistoryEntry = { updatedBy: trimmedName, updatedAt: now };
      if (updateNote.trim()) entry.note = updateNote.trim();
      updateHistory = [...updateHistory, entry];
    }
    const parsedKeywords = keywordsText.split(/[,、\s]+/).map((k) => k.trim()).filter(Boolean);
    return {
      id: initialData?.id || uuidv4(),
      title: title.trim(), category, description: description.trim(), steps,
      createdAt: initialData?.createdAt || now, updatedAt: now,
      createdBy: initialData?.createdBy || trimmedName || undefined,
      updatedBy: isEdit && trimmedName ? trimmedName : initialData?.updatedBy,
      updateHistory: updateHistory.length > 0 ? updateHistory : undefined,
      status, keywords: parsedKeywords.length > 0 ? parsedKeywords : undefined,
    };
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessModal, setSaveSuccessModal] = useState<{ folderName: string; folderUrl?: string } | null>(null);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);

  const handleDraftSave = (continueEditing: boolean) => {
    const instruction = buildInstruction('draft');
    if (!instruction) return;
    try { saveInstruction(instruction); } catch (e) { alert(e instanceof Error ? e.message : '保存に失敗しました。'); return; }
    if (continueEditing) {
      setDraftSaveMessage('下書きを保存しました');
      setTimeout(() => setDraftSaveMessage(null), 3000);
    } else {
      router.push('/instructions/drafts');
    }
  };

  const handleJsonExport = () => {
    const instruction = buildInstruction('draft');
    if (!instruction) return;
    const blob = new Blob([JSON.stringify(instruction, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${instruction.title || '手順書'}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const saveToFolder = async (instruction: WorkInstruction) => {
    setSaving(true); setSaveError(null);
    try {
      const { buffer: excelBuffer, stepNavRows, indexNavRows } = await buildExcelBuffer(instruction, excelNavMode);
      const sheetName = `${instruction.title}_手順書`;
      const spreadsheetId = await uploadAsGoogleSheet(excelBuffer, sheetName);
      if (excelNavMode === 'jump') await addStepNavLinks(spreadsheetId, instruction, stepNavRows, indexNavRows);
      const jsonBuffer = new TextEncoder().encode(JSON.stringify(instruction, null, 2)).buffer;
      await saveFileToDrive(jsonBuffer, `${instruction.title}.json`, 'application/json');
      const targetFolder = getTargetFolder();
      const folderName = targetFolder?.name || 'WorkInstructions';
      const folderUrl = targetFolder?.id ? `https://drive.google.com/drive/folders/${targetFolder.id}` : undefined;
      try { saveInstruction(instruction); } catch { /* 無視 */ }
      setSaveSuccessModal({ folderName, folderUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message
        : (typeof err === 'object' && err !== null && 'result' in err) ? JSON.stringify((err as { result: unknown }).result) : String(err);
      setSaveError(`Driveへの保存に失敗: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteClick = () => {
    const instruction = buildInstruction('completed');
    if (!instruction) return;
    if (!isGoogleConfigured() || !getAuthState().isSignedIn) {
      alert('Googleにログインしてください。ヘッダーの「Google Drive」ボタンからログインできます。'); return;
    }
    const targetFolder = getTargetFolder();
    if (!targetFolder) {
      alert('Driveフォルダが指定されていません。ヘッダーのフォルダボタンから設定してください。'); return;
    }
    saveToFolder(instruction);
  };

  return (
    <>
    <form onSubmit={(e) => { e.preventDefault(); handleCompleteClick(); }} className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-[#1d1d1f] tracking-tight">
        {isEdit ? '手順書を編集' : '新規手順書作成'}
      </h1>

      {/* Basic info */}
      <div className="bg-white rounded-2xl border border-[#e8e8ed] p-6 space-y-5">
        <div>
          <label className={labelCls}>タイトル <span className="text-[#ff3b30]">*</span></label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            className={inputCls} placeholder="例: 出荷伝票の作成手順" required />
        </div>

        <div>
          <label className={labelCls}>カテゴリ <span className="text-[#ff3b30]">*</span></label>
          {showCustomCategory ? (
            <div className="flex gap-2">
              <input type="text" value={customCategory}
                onChange={(e) => { setCustomCategory(e.target.value); setCategory(e.target.value); }}
                className={inputCls} placeholder="カテゴリ名を入力" autoFocus />
              <button type="button"
                onClick={() => { setShowCustomCategory(false); setCustomCategory(''); setCategory(DEFAULT_CATEGORIES[0]); }}
                className="px-4 py-2 text-sm text-[#6e6e73] hover:text-[#1d1d1f] border border-[#d2d2d7] rounded-xl transition whitespace-nowrap">
                戻す
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className={`${inputCls} flex-1`}>
                {DEFAULT_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <button type="button" onClick={() => setShowCustomCategory(true)}
                className="px-4 py-2 text-sm text-[#0071e3] hover:text-[#0077ed] border border-[#d2d2d7] rounded-xl transition whitespace-nowrap">
                + 新規
              </button>
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>{isEdit ? '更新者名' : '作成者名'} <span className="text-[#ff3b30]">*</span></label>
          <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)}
            className={inputCls} placeholder={isEdit ? '更新者の名前を入力' : '作成者の名前を入力'} />
        </div>

        {isEdit && (
          <div className="space-y-2">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input type="checkbox" checked={addHistory} onChange={(e) => setAddHistory(e.target.checked)}
                className="w-4 h-4 rounded border-[#d2d2d7] accent-[#0071e3]" />
              <span className="text-sm font-medium text-[#1d1d1f]">改版履歴に記録する</span>
              <span className="text-xs text-[#86868b]">（大きな変更があった場合にチェック）</span>
            </label>
            {addHistory && (
              <input type="text" value={updateNote} onChange={(e) => setUpdateNote(e.target.value)}
                className={inputCls} placeholder="例: ステップ3の手順を大幅変更" />
            )}
          </div>
        )}

        <div>
          <label className={labelCls}>概要</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
            className={`${inputCls} resize-y`} placeholder="この手順書の概要を記入してください" />
        </div>

        <div>
          <label className={labelCls}>
            関連キーワード <span className="text-[#86868b] font-normal text-xs">（任意）</span>
          </label>
          <input type="text" value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)}
            className={inputCls} placeholder="例: 出荷, 伝票, 梱包（カンマ区切りで入力）" />
          <p className="mt-1.5 text-xs text-[#86868b]">資料検索時にヒットさせるためのキーワードを入力してください</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#1d1d1f]">手順ステップ</h2>
        {steps.map((step, index) => (
          <StepEditor key={step.id} step={step} index={index} totalSteps={steps.length}
            onChange={(s) => handleStepChange(index, s)}
            onRemove={() => handleRemoveStep(index)}
            onMoveUp={() => handleMoveStep(index, 'up')}
            onMoveDown={() => handleMoveStep(index, 'down')} />
        ))}
        <button type="button" onClick={handleAddStep}
          className="w-full py-4 border-2 border-dashed border-[#d2d2d7] rounded-2xl text-[#6e6e73] hover:border-[#0071e3] hover:text-[#0071e3] transition font-medium text-sm">
          + ステップを追加
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-4 pt-2">
        {/* Output mode */}
        <div className="flex items-center gap-5 px-1">
          <span className="text-sm font-medium text-[#6e6e73]">出力モード:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="excelNavMode" value="jump" checked={excelNavMode === 'jump'}
              onChange={() => setExcelNavMode('jump')} className="accent-[#0071e3]" />
            <span className="text-sm text-[#1d1d1f]">ステップ別シート</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input type="radio" name="excelNavMode" value="scroll" checked={excelNavMode === 'scroll'}
              onChange={() => setExcelNavMode('scroll')} className="accent-[#0071e3]" />
            <span className="text-sm text-[#1d1d1f]">スクロール<span className="text-[#86868b]">（従来通り）</span></span>
          </label>
        </div>

        {draftSaveMessage && (
          <p className="text-sm text-center text-[#34c759] font-medium">{draftSaveMessage}</p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button type="button" onClick={() => handleDraftSave(true)} disabled={saving}
            className="flex-1 py-3 bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-full font-medium text-sm hover:bg-[#e8e8ed] transition disabled:opacity-50">
            下書き保存（継続）
          </button>
          <button type="button" onClick={() => handleDraftSave(false)} disabled={saving}
            className="flex-1 py-3 bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-full font-medium text-sm hover:bg-[#e8e8ed] transition disabled:opacity-50">
            下書き保存して終了
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full font-medium text-sm transition disabled:opacity-50">
            {saving ? '保存中...' : '完成'}
          </button>
        </div>

        <button type="button" onClick={handleJsonExport}
          className="w-full py-2.5 text-sm text-[#6e6e73] hover:text-[#1d1d1f] border border-[#e8e8ed] rounded-full transition">
          JSONで保存（ストレージ容量不足時の代替保存）
        </button>
        <button type="button" onClick={() => router.back()}
          className="w-full py-2 text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition">
          キャンセル
        </button>

        {saveError && <p className="text-sm text-center text-[#ff3b30]">{saveError}</p>}

        <p className="text-xs text-[#86868b] text-center">
          「完成」を押すと、ヘッダーで指定したGoogleドライブフォルダにスプレッドシート・JSONを出力します
        </p>
      </div>
    </form>

    {saveSuccessModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-5">
          <div className="w-14 h-14 rounded-full bg-[#e8f8ee] flex items-center justify-center">
            <svg className="w-7 h-7 text-[#34c759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-base font-semibold text-[#1d1d1f]">保存しました</p>
            <p className="text-sm text-[#6e6e73]">
              保存先:{' '}
              {saveSuccessModal.folderUrl ? (
                <a href={saveSuccessModal.folderUrl} target="_blank" rel="noopener noreferrer"
                  className="text-[#0071e3] underline font-medium hover:opacity-80">
                  {saveSuccessModal.folderName}
                </a>
              ) : (
                <span className="font-medium text-[#1d1d1f]">{saveSuccessModal.folderName}</span>
              )}
            </p>
          </div>
          <button onClick={() => router.push('/')}
            className="w-full py-3 bg-[#0071e3] hover:bg-[#0077ed] text-white font-medium rounded-full transition">
            OK
          </button>
        </div>
      </div>
    )}
    </>
  );
}
