'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import {
  WorkInstruction,
  Step,
  Condition,
  DEFAULT_CATEGORIES,
  UpdateHistoryEntry,
  InstructionSnapshot,
  InstructionStatus,
} from '@/types/instruction';
import { saveInstruction } from '@/lib/storage';
import { buildExcelBuffer, ExcelNavMode } from '@/lib/exportSpreadsheet';
import { uploadAsGoogleSheet, saveFileToDrive, getTargetFolder } from '@/lib/googleDrive';
import { addStepNavLinks, addSheetCheckboxes, addResetScript } from '@/lib/sheetsNavLinks';
import { getViewPageBaseUrl } from '@/lib/shareLink';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';
import StepEditor from './StepEditor';
import VersionHistoryModal from './VersionHistoryModal';

const LAST_AUTHOR_KEY = 'last_author_name';
const fieldClass =
  'w-full border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-sm font-semibold text-slate-700';

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

export default function InstructionForm({ initialData }: InstructionFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;

  const [title, setTitle] = useState(initialData?.title || '');
  const [category, setCategory] = useState(initialData?.category || DEFAULT_CATEGORIES[0]);
  const [showCustomCategory, setShowCustomCategory] = useState(
    !!initialData?.category &&
      !DEFAULT_CATEGORIES.includes(initialData.category as (typeof DEFAULT_CATEGORIES)[number]),
  );
  const [customCategory, setCustomCategory] = useState(
    initialData?.category &&
      !DEFAULT_CATEGORIES.includes(initialData.category as (typeof DEFAULT_CATEGORIES)[number])
      ? initialData.category
      : '',
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [steps, setSteps] = useState<Step[]>(
    initialData?.steps?.length
      ? [...initialData.steps].sort((a, b) => a.orderIndex - b.orderIndex)
      : [createEmptyStep(0)],
  );
  const [authorName, setAuthorName] = useState(
    initialData?.updatedBy || initialData?.createdBy || getLastAuthorName(),
  );
  const [updateNote, setUpdateNote] = useState('');
  const [addHistory, setAddHistory] = useState(false);
  const [keywordsText, setKeywordsText] = useState(initialData?.keywords?.join(', ') || '');
  const [excelNavMode, setExcelNavMode] = useState<ExcelNavMode>('none');
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [conditions, setConditions] = useState<Condition[]>(() => {
    const raw = initialData?.conditions ?? [];
    if (raw.length === 0) return [];
    if (raw.some((c) => c.group)) return raw;
    const defaultGroup = uuidv4();
    return raw.map((c) => ({ ...c, group: defaultGroup }));
  });
  const [groupParents, setGroupParents] = useState<Record<string, string | undefined>>(() => {
    const parents: Record<string, string | undefined> = {};
    for (const cg of initialData?.conditionGroups ?? []) {
      if (cg.parentConditionId) parents[cg.id] = cg.parentConditionId;
    }
    return parents;
  });
  const [sequential, setSequential] = useState<boolean>(initialData?.sequential ?? false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'error'; folderUrl?: string } | null>(null);
  const [saveSuccessModal, setSaveSuccessModal] = useState<{
    folderName: string;
    folderUrl?: string;
    viewUrl?: string;
    excelExported: boolean;
  } | null>(null);
  const [viewUrlCopied, setViewUrlCopied] = useState(false);
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);

  const hasRestorableVersions =
    isEdit && initialData?.updateHistory?.some((entry) => !!entry.snapshot);

  const handleRestoreVersion = (snapshot: InstructionSnapshot) => {
    setTitle(snapshot.title);
    setCategory(snapshot.category);
    if (
      !DEFAULT_CATEGORIES.includes(snapshot.category as (typeof DEFAULT_CATEGORIES)[number])
    ) {
      setShowCustomCategory(true);
      setCustomCategory(snapshot.category);
    } else {
      setShowCustomCategory(false);
      setCustomCategory('');
    }
    setDescription(snapshot.description);
    setSteps(snapshot.steps);
    setKeywordsText(snapshot.keywords?.join(', ') || '');
    setShowVersionHistory(false);
  };

  const handleAddStep = () => setSteps([...steps, createEmptyStep(steps.length)]);

  const handleInsertStep = (afterIndex: number) => {
    const newSteps = [...steps];
    newSteps.splice(afterIndex + 1, 0, createEmptyStep(afterIndex + 1));
    setSteps(newSteps.map((step, index) => ({ ...step, orderIndex: index })));
  };

  const handleStepChange = (index: number, updatedStep: Step) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  const handleRemoveStep = (index: number) => {
    if (steps.length <= 1) {
      alert('ステップは1件以上必要です。');
      return;
    }
    setSteps(steps.filter((_, i) => i !== index).map((step, i) => ({ ...step, orderIndex: i })));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps.map((step, i) => ({ ...step, orderIndex: i })));
  };

  const addGroup = () => {
    const groupId = uuidv4();
    setConditions((prev) => [...prev, { id: uuidv4(), label: '', group: groupId }]);
  };

  const addConditionToGroup = (groupId: string) => {
    setConditions((prev) => [...prev, { id: uuidv4(), label: '', group: groupId }]);
  };

  const removeCondition = (condId: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== condId));
    setSteps((prev) =>
      prev.map((step) =>
        step.conditionId === condId ? { ...step, conditionId: undefined } : step,
      ),
    );
    setGroupParents((prev) => {
      const updated = { ...prev };
      for (const [groupId, parentId] of Object.entries(updated)) {
        if (parentId === condId) delete updated[groupId];
      }
      return updated;
    });
  };

  const removeGroup = (groupId: string) => {
    const condIds = new Set(conditions.filter((c) => c.group === groupId).map((c) => c.id));
    setConditions((prev) => prev.filter((c) => c.group !== groupId));
    setSteps((prev) =>
      prev.map((step) =>
        condIds.has(step.conditionId ?? '') ? { ...step, conditionId: undefined } : step,
      ),
    );
    setGroupParents((prev) => {
      const updated = { ...prev };
      delete updated[groupId];
      for (const [gid, parentId] of Object.entries(updated)) {
        if (parentId && condIds.has(parentId)) delete updated[gid];
      }
      return updated;
    });
  };

  const buildInstruction = (status: InstructionStatus): WorkInstruction | null => {
    if (!title.trim()) {
      alert('タイトルを入力してください。');
      return null;
    }

    if (status === 'completed') {
      if (steps.some((step) => !step.title.trim())) {
        alert('空欄のステップ名があります。すべて入力してください。');
        return null;
      }
      if (!authorName.trim()) {
        alert(isEdit ? '更新者名を入力してください。' : '作成者名を入力してください。');
        return null;
      }
    }

    const trimmedName = authorName.trim();
    if (trimmedName) saveLastAuthorName(trimmedName);

    const now = new Date().toISOString();
    let updateHistory: UpdateHistoryEntry[] = initialData?.updateHistory || [];
    if (isEdit && trimmedName && addHistory) {
      const snapshot: InstructionSnapshot = {
        title: initialData!.title,
        category: initialData!.category,
        description: initialData!.description,
        steps: initialData!.steps,
        keywords: initialData!.keywords,
        createdBy: initialData!.createdBy,
      };
      const entry: UpdateHistoryEntry = {
        updatedBy: trimmedName,
        updatedAt: now,
        snapshot,
      };
      if (updateNote.trim()) entry.note = updateNote.trim();
      updateHistory = [...updateHistory, entry];
    }

    const parsedKeywords = keywordsText
      .split(/[,\s]+/)
      .map((keyword) => keyword.trim())
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
      conditions: conditions.length > 0 ? conditions : undefined,
      conditionGroups: (() => {
        const groups = Object.entries(groupParents)
          .filter((entry): entry is [string, string] => !!entry[1])
          .map(([id, parentConditionId]) => ({ id, parentConditionId }));
        return groups.length > 0 ? groups : undefined;
      })(),
      sequential: sequential || undefined,
    };
  };

  const handleDraftSave = (continueEditing: boolean) => {
    const instruction = buildInstruction('draft');
    if (!instruction) return;

    try {
      saveInstruction(instruction);
    } catch (error) {
      alert(error instanceof Error ? error.message : '下書き保存に失敗しました。');
      return;
    }

    if (continueEditing) {
      setDraftSaveMessage('下書きを保存しました。');
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
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${instruction.title || '手順書'}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveToFolder = async (instruction: WorkInstruction) => {
    setSaving(true);
    setSaveMessage(null);

    try {
      let scriptAttached = false;
      const excelExported = excelNavMode !== 'none';

      if (excelExported) {
        const { buffer: excelBuffer, stepNavRows, indexNavRows, checkboxCells } =
          await buildExcelBuffer(instruction, excelNavMode);
        const sheetName = `${instruction.title}_手順書`;
        const spreadsheetId = await uploadAsGoogleSheet(excelBuffer, sheetName);

        if (excelNavMode === 'jump') {
          await addStepNavLinks(spreadsheetId, instruction, stepNavRows, indexNavRows);
        }

        if (checkboxCells.length > 0) {
          await addSheetCheckboxes(spreadsheetId, checkboxCells);
          scriptAttached = await addResetScript(spreadsheetId);
        }
      }

      const jsonStr = JSON.stringify(instruction, null, 2);
      const jsonBuffer = new TextEncoder().encode(jsonStr).buffer;
      const driveFileId = await saveFileToDrive(
        jsonBuffer,
        `${instruction.title}.json`,
        'application/json',
      );
      const targetFolder = getTargetFolder();
      const folderName = targetFolder?.name || 'WorkInstructions';
      const folderUrl = targetFolder?.id
        ? `https://drive.google.com/drive/folders/${targetFolder.id}`
        : undefined;
      const viewUrl = `${getViewPageBaseUrl()}?driveFileId=${driveFileId}`;

      try {
        saveInstruction({ ...instruction, driveFileId });
      } catch {}

      setSaveSuccessModal({ folderName, folderUrl, viewUrl, excelExported });
      void scriptAttached;
    } catch (error) {
      console.error('Drive save error:', error);
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'result' in error
            ? JSON.stringify((error as { result: unknown }).result)
            : String(error);
      setSaveMessage({
        text: `Driveへの保存に失敗しました: ${message}`,
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteClick = () => {
    const instruction = buildInstruction('completed');
    if (!instruction) return;

    if (!isGoogleConfigured() || !getAuthState().isSignedIn) {
      alert('Google にサインインしてから Google Drive 保存を実行してください。');
      return;
    }

    if (!getTargetFolder()) {
      alert('Drive の保存先フォルダが未設定です。先に保存先を選択してください。');
      return;
    }

    void saveToFolder(instruction);
  };

  const groupedConditions = (() => {
    const groupOrder: string[] = [];
    const grouped = new Map<string, Condition[]>();
    for (const condition of conditions) {
      const groupId = condition.group || '__default';
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
        groupOrder.push(groupId);
      }
      grouped.get(groupId)!.push(condition);
    }
    return { groupOrder, grouped };
  })();

  return (
    <>
      <form
        className="mx-auto max-w-6xl px-4 py-8"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-[0.16em] text-blue-700">
              {isEdit ? 'EDIT MANUAL' : 'NEW MANUAL'}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              {isEdit ? '手順書の編集' : '新規手順書の作成'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              基本情報、条件分岐、各ステップを入力してDriveへ保存します。
            </p>
          </div>
          <LinkButton href="/" label="ホームへ戻る" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-slate-950">基本情報</h2>
                <p className="mt-1 text-sm text-slate-500">
                  検索や共有時に表示される情報です。
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={labelClass}>
                    タイトル <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className={fieldClass}
                    placeholder="例: 出荷伝票の作成手順"
                    required
                  />
                </div>

                <div>
                  <label className={labelClass}>
                    カテゴリ <span className="text-red-500">*</span>
                  </label>
                  {showCustomCategory ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(event) => {
                          setCustomCategory(event.target.value);
                          setCategory(event.target.value);
                        }}
                        className={fieldClass}
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
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                      >
                        戻す
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <select
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        className={fieldClass}
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
                        className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50"
                      >
                        追加
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>
                    {isEdit ? '更新者名' : '作成者名'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(event) => setAuthorName(event.target.value)}
                    className={fieldClass}
                    placeholder={isEdit ? '更新者の名前を入力' : '作成者の名前を入力'}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>概要</label>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                    className={`${fieldClass} resize-y`}
                    placeholder="この手順書の目的や対象作業を入力してください"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={labelClass}>
                    キーワード <span className="font-normal text-slate-400">任意</span>
                  </label>
                  <input
                    type="text"
                    value={keywordsText}
                    onChange={(event) => setKeywordsText(event.target.value)}
                    className={fieldClass}
                    placeholder="例: 出荷, 伝票, 物流"
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    カンマまたはスペース区切りで入力してください。
                  </p>
                </div>
              </div>

              {isEdit && (
                <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={addHistory}
                      onChange={(event) => setAddHistory(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-semibold text-slate-700">
                      更新履歴に追記する
                    </span>
                    <span className="text-xs text-slate-500">
                      大きな変更があった場合にチェックしてください
                    </span>
                  </label>

                  {addHistory && (
                    <input
                      type="text"
                      value={updateNote}
                      onChange={(event) => setUpdateNote(event.target.value)}
                      className={`${fieldClass} mt-3`}
                      placeholder="例: 手順の順番を見直し"
                    />
                  )}

                  {hasRestorableVersions && (
                    <button
                      type="button"
                      onClick={() => setShowVersionHistory(true)}
                      className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
                    >
                      更新履歴を見る
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-950">条件分岐</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    条件ごとの手順をグループ単位で整理できます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addGroup}
                  className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  グループを追加
                </button>
              </div>

              {groupedConditions.groupOrder.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
                  条件分岐はまだ設定されていません。
                </p>
              ) : (
                <div className="space-y-3">
                  {groupedConditions.groupOrder.map((groupId, groupIndex) => {
                    const otherConditions = conditions.filter((c) => c.group !== groupId);
                    return (
                      <div
                        key={groupId}
                        className="rounded-lg border border-blue-100 bg-blue-50/50 p-4"
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-blue-800">
                            グループ {String.fromCharCode(65 + groupIndex)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeGroup(groupId)}
                            className="text-xs font-medium text-red-600 hover:text-red-800"
                          >
                            グループ削除
                          </button>
                        </div>

                        {otherConditions.length > 0 && (
                          <div className="mb-3 flex items-center gap-2">
                            <label className="shrink-0 text-xs font-medium text-slate-600">
                              親条件
                            </label>
                            <select
                              value={groupParents[groupId] ?? ''}
                              onChange={(event) =>
                                setGroupParents((prev) => ({
                                  ...prev,
                                  [groupId]: event.target.value || undefined,
                                }))
                              }
                              className={`${fieldClass} py-1.5 text-xs`}
                            >
                              <option value="">なし（単独で表示）</option>
                              {otherConditions.map((condition) => (
                                <option key={condition.id} value={condition.id}>
                                  {condition.label || '(未入力)'}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div className="space-y-2">
                          {groupedConditions.grouped.get(groupId)!.map((condition) => (
                            <div key={condition.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={condition.label}
                                onChange={(event) =>
                                  setConditions((prev) =>
                                    prev.map((c) =>
                                      c.id === condition.id
                                        ? { ...c, label: event.target.value }
                                        : c,
                                    ),
                                  )
                                }
                                className={`${fieldClass} py-2`}
                                placeholder="例: Aの場合"
                              />
                              <button
                                type="button"
                                onClick={() => removeCondition(condition.id)}
                                className="rounded-lg px-2 py-1 text-lg leading-none text-red-500 hover:bg-red-50"
                                title="条件を削除"
                              >
                                &times;
                              </button>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => addConditionToGroup(groupId)}
                          className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
                        >
                          + 条件を追加
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">手順ステップ</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    必要な順番に沿ってステップを追加します。
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
                  {steps.length} ステップ
                </span>
              </div>

              {steps.map((step, index) => (
                <Fragment key={step.id}>
                  <StepEditor
                    step={step}
                    index={index}
                    totalSteps={steps.length}
                    conditions={conditions}
                    allSteps={steps}
                    onChange={(updatedStep) => handleStepChange(index, updatedStep)}
                    onRemove={() => handleRemoveStep(index)}
                    onMoveUp={() => handleMoveStep(index, 'up')}
                    onMoveDown={() => handleMoveStep(index, 'down')}
                  />
                  {index < steps.length - 1 && (
                    <button
                      type="button"
                      onClick={() => handleInsertStep(index)}
                      className="w-full rounded-lg border border-dashed border-slate-300 bg-white py-2 text-sm font-medium text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      + ここにステップを挿入
                    </button>
                  )}
                </Fragment>
              ))}

              <button
                type="button"
                onClick={handleAddStep}
                className="w-full rounded-lg border border-dashed border-blue-300 bg-blue-50 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
              >
                + ステップを追加
              </button>
            </section>
          </div>

          <aside className="h-fit space-y-4 lg:sticky lg:top-24">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">保存設定</h2>

              <label className="mt-4 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={sequential}
                  onChange={(event) => setSequential(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-700">
                    読み飛ばし防止モード
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    閲覧時に「次へ」ボタンで1ステップずつ表示します。
                  </span>
                </span>
              </label>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">Excel出力</p>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="excelNavMode"
                    value="none"
                    checked={excelNavMode === 'none'}
                    onChange={() => setExcelNavMode('none')}
                    className="accent-blue-600"
                  />
                  出力無し
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="excelNavMode"
                    value="jump"
                    checked={excelNavMode === 'jump'}
                    onChange={() => setExcelNavMode('jump')}
                    className="accent-blue-600"
                  />
                  ステップ別シート
                </label>
                <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
                  <input
                    type="radio"
                    name="excelNavMode"
                    value="scroll"
                    checked={excelNavMode === 'scroll'}
                    onChange={() => setExcelNavMode('scroll')}
                    className="accent-blue-600"
                  />
                  スクロール（従来通り）
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="space-y-3">
                {draftSaveMessage && (
                  <p className="rounded-lg bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-700">
                    {draftSaveMessage}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleDraftSave(true)}
                  disabled={saving}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  下書き保存して継続
                </button>
                <button
                  type="button"
                  onClick={() => handleDraftSave(false)}
                  disabled={saving}
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  下書き保存して終了
                </button>
                <button
                  type="button"
                  onClick={handleCompleteClick}
                  disabled={saving}
                  className="w-full rounded-lg bg-slate-950 px-4 py-3 text-base font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {saving ? '保存中...' : '完成してDriveへ保存'}
                </button>
                <button
                  type="button"
                  onClick={handleJsonExport}
                  className="w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  JSONで保存
                </button>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full px-4 py-2 text-sm text-slate-500 transition hover:text-slate-800"
                >
                  キャンセル
                </button>
                {saveMessage && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {saveMessage.text}
                  </p>
                )}
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                完成時は、指定した Google Drive フォルダに JSON を保存します。Excel出力を選んだ場合のみ、
                スプレッドシートも保存します。
              </p>
            </section>
          </aside>
        </div>
      </form>

      {saveSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-bold text-slate-950">保存しました</p>
                <p className="text-sm text-slate-500">
                  保存先:{' '}
                  {saveSuccessModal.folderUrl ? (
                    <a
                      href={saveSuccessModal.folderUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-700 underline"
                    >
                      {saveSuccessModal.folderName}
                    </a>
                  ) : (
                    <span className="font-medium text-slate-700">
                      {saveSuccessModal.folderName}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {saveSuccessModal.excelExported
                    ? 'JSON と Excel を保存しました'
                    : 'JSON のみ保存しました'}
                </p>
              </div>
            </div>

            {saveSuccessModal.viewUrl && (
              <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="mb-2 text-xs font-bold text-blue-900">
                  閲覧リンク（Googleログインで開けます）
                </p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={saveSuccessModal.viewUrl}
                    className="min-w-0 flex-1 border border-blue-200 bg-white px-2 py-1.5 text-xs text-slate-700 outline-none"
                    onClick={(event) => (event.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(saveSuccessModal.viewUrl!);
                      setViewUrlCopied(true);
                      setTimeout(() => setViewUrlCopied(false), 2000);
                    }}
                    className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800"
                  >
                    {viewUrlCopied ? 'コピー済み' : 'コピー'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full rounded-lg bg-slate-950 py-3 font-bold text-white transition hover:bg-slate-800"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {showVersionHistory && initialData?.updateHistory && (
        <VersionHistoryModal
          history={initialData.updateHistory}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = href;
      }}
      className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
    >
      {label}
    </button>
  );
}
