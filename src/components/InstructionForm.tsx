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
  return {
    id: uuidv4(),
    orderIndex,
    title: '',
    description: '',
  };
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
      ? initialData.category
      : ''
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
  const [keywordsText, setKeywordsText] = useState(
    initialData?.keywords?.join(', ') || ''
  );
  const [excelNavMode, setExcelNavMode] = useState<ExcelNavMode>('scroll');

  const handleAddStep = () => {
    setSteps([...steps, createEmptyStep(steps.length)]);
  };

  const handleStepChange = (index: number, updatedStep: Step) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      alert('最低1つのステップが必要です。');
      return;
    }
    const newSteps = steps
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, orderIndex: i }));
    setSteps(newSteps);
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((s, i) => ({ ...s, orderIndex: i })));
  };

  const buildInstruction = (status: InstructionStatus): WorkInstruction | null => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return null;
    }

    // For completion, validate all steps and author
    if (status === 'completed') {
      if (steps.some((s) => !s.title.trim())) {
        alert('すべてのステップにタイトルを入力してください。');
        return null;
      }
      if (!authorName.trim()) {
        alert(isEdit ? '更新者名を入力してください。' : '作成者名を入力してください。');
        return null;
      }
    }

    const trimmedName = authorName.trim();
    if (trimmedName) {
      saveLastAuthorName(trimmedName);
    }

    const now = new Date().toISOString();

    let updateHistory: UpdateHistoryEntry[] = initialData?.updateHistory || [];
    if (isEdit && trimmedName && addHistory) {
      const entry: UpdateHistoryEntry = {
        updatedBy: trimmedName,
        updatedAt: now,
      };
      if (updateNote.trim()) {
        entry.note = updateNote.trim();
      }
      updateHistory = [...updateHistory, entry];
    }

    const parsedKeywords = keywordsText
      .split(/[,、\s]+/)
      .map((k) => k.trim())
      .filter(Boolean);

    return {
      id: initialData?.id || uuidv4(),
      title: title.trim(),
      category,
      description: description.trim(),
      steps,
      createdAt: initialData?.createdAt || now,
      updatedAt: now,
      createdBy: initialData?.createdBy || trimmedName || undefined,
      updatedBy: isEdit && trimmedName ? trimmedName : initialData?.updatedBy,
      updateHistory: updateHistory.length > 0 ? updateHistory : undefined,
      status,
      keywords: parsedKeywords.length > 0 ? parsedKeywords : undefined,
    };
  };

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);

  const handleDraftSave = (continueEditing: boolean) => {
    const instruction = buildInstruction('draft');
    if (!instruction) return;

    try {
      saveInstruction(instruction);
    } catch (e) {
      alert(e instanceof Error ? e.message : '保存に失敗しました。');
      return;
    }
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
    const json = JSON.stringify(instruction, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${instruction.title || '手順書'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveToFolder = async (instruction: WorkInstruction) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const { buffer: excelBuffer, stepNavRows, indexNavRows } = await buildExcelBuffer(instruction, excelNavMode);

      if (excelNavMode === 'jump') {
        // ステップ別シートモード: Google Sheets ネイティブ形式でアップロード後、
        // Sheets API で「次へ」ナビゲーションリンクを挿入
        const sheetName = `${instruction.title}_手順書`;
        const spreadsheetId = await uploadAsGoogleSheet(excelBuffer, sheetName);
        await addStepNavLinks(spreadsheetId, instruction, stepNavRows, indexNavRows);
      } else {
        // スクロールモード: 通常の XLSX としてアップロード
        await saveFileToDrive(
          excelBuffer,
          `${instruction.title}_手順書.xlsx`,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );
      }

      // Upload JSON (both modes)
      const jsonStr = JSON.stringify(instruction, null, 2);
      const jsonBuffer = new TextEncoder().encode(jsonStr).buffer;
      await saveFileToDrive(
        jsonBuffer,
        `${instruction.title}.json`,
        'application/json',
      );
      const folderName = getTargetFolder()?.name || 'WorkInstructions';
      // ローカルストレージのステータスも completed に更新（下書き残留を防止）
      try { saveInstruction(instruction); } catch { /* Drive保存は成功しているので無視 */ }
      const fileType = excelNavMode === 'jump' ? 'Google スプレッドシート' : 'Excel';
      setSaveMessage({ text: `「${folderName}」に${fileType}・JSONを保存しました`, type: 'success' });
      setTimeout(() => router.push('/'), 1500);
    } catch (err) {
      console.error('Drive save error:', err);
      const msg = err instanceof Error
        ? err.message
        : (typeof err === 'object' && err !== null && 'result' in err)
          ? JSON.stringify((err as { result: unknown }).result)
          : String(err);
      setSaveMessage({ text: `Driveへの保存に失敗: ${msg}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteClick = () => {
    const instruction = buildInstruction('completed');
    if (!instruction) return;

    // 1. Googleログインチェック
    if (!isGoogleConfigured() || !getAuthState().isSignedIn) {
      alert('Googleにログインしてください。ヘッダーの「Google Drive」ボタンからログインできます。');
      return;
    }

    // 2. 保存フォルダチェック
    const targetFolder = getTargetFolder();
    if (!targetFolder) {
      alert('Driveフォルダが指定されていません。ヘッダーのフォルダボタンから設定してください。');
      return;
    }

    // 3. Google Driveに保存
    saveToFolder(instruction);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleCompleteClick();
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        {isEdit ? '手順書を編集' : '新規手順書作成'}
      </h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            タイトル <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="例: 出荷伝票の作成手順"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            カテゴリ <span className="text-red-500">*</span>
          </label>
          {showCustomCategory ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={customCategory}
                onChange={(e) => {
                  setCustomCategory(e.target.value);
                  setCategory(e.target.value);
                }}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="カテゴリ名を入力"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setShowCustomCategory(false);
                  setCustomCategory('');
                  setCategory(DEFAULT_CATEGORIES[0]);
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded transition"
              >
                戻す
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowCustomCategory(true)}
                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-800 border border-blue-300 hover:border-blue-400 rounded transition whitespace-nowrap"
              >
                + 新規
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {isEdit ? '更新者名' : '作成者名'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder={isEdit ? '更新者の名前を入力' : '作成者の名前を入力'}
          />
        </div>

        {isEdit && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addHistory}
                onChange={(e) => setAddHistory(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">改版履歴に記録する</span>
              <span className="text-xs text-gray-400">（大きな変更があった場合にチェック）</span>
            </label>
            {addHistory && (
              <input
                type="text"
                value={updateNote}
                onChange={(e) => setUpdateNote(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="例: ステップ3の手順を大幅変更"
              />
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">概要</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y"
            placeholder="この手順書の概要を記入してください"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            関連キーワード <span className="text-gray-400 font-normal">(任意)</span>
          </label>
          <input
            type="text"
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            placeholder="例: 出荷, 伝票, 梱包（カンマ区切りで入力）"
          />
          <p className="mt-1 text-xs text-gray-400">資料検索時にヒットさせるためのキーワードを入力してください</p>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-700">手順ステップ</h2>
        {steps.map((step, index) => (
          <StepEditor
            key={step.id}
            step={step}
            index={index}
            totalSteps={steps.length}
            onChange={(s) => handleStepChange(index, s)}
            onRemove={() => handleRemoveStep(index)}
            onMoveUp={() => handleMoveStep(index, 'up')}
            onMoveDown={() => handleMoveStep(index, 'down')}
          />
        ))}

        <button
          type="button"
          onClick={handleAddStep}
          className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-400 hover:text-blue-500 transition font-medium"
        >
          + ステップを追加
        </button>
      </div>

      {/* Actions */}
      <div className="space-y-3 pt-4">
        {/* Excel nav mode selector */}
        <div className="flex items-center gap-4 px-1">
          <span className="text-sm font-medium text-slate-600">Excel閲覧モード:</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="excelNavMode"
              value="scroll"
              checked={excelNavMode === 'scroll'}
              onChange={() => setExcelNavMode('scroll')}
              className="accent-blue-600"
            />
            <span className="text-sm text-slate-600">スクロール</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="excelNavMode"
              value="jump"
              checked={excelNavMode === 'jump'}
              onChange={() => setExcelNavMode('jump')}
              className="accent-blue-600"
            />
            <span className="text-sm text-slate-600">ステップ別シート</span>
          </label>
        </div>
        {draftSaveMessage && (
          <p className="text-sm text-center text-emerald-600 font-medium">{draftSaveMessage}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => handleDraftSave(true)}
            disabled={saving}
            className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-600 rounded-xl font-bold text-base hover:bg-slate-50 transition disabled:opacity-50"
          >
            下書き保存（継続）
          </button>
          <button
            type="button"
            onClick={() => handleDraftSave(false)}
            disabled={saving}
            className="flex-1 py-3.5 bg-amber-50 border-2 border-amber-300 text-amber-700 rounded-xl font-bold text-base hover:bg-amber-100 transition disabled:opacity-50"
          >
            下書き保存して終了
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-bold text-lg hover:from-emerald-600 hover:to-green-700 transition shadow-md disabled:opacity-50"
          >
            {saving ? '保存中...' : '完成'}
          </button>
        </div>
        <button
          type="button"
          onClick={handleJsonExport}
          className="w-full py-2.5 text-sm text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
        >
          JSONで保存（ストレージ容量不足時の代替保存）
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          キャンセル
        </button>
        {saveMessage && (
          <p className={`text-sm text-center ${saveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {saveMessage.text}
          </p>
        )}
        <p className="text-xs text-slate-400 text-center">
          「完成」を押すと、ヘッダーで指定したGoogleドライブフォルダにExcel・JSONを出力します
        </p>
      </div>
    </form>
  );
}
