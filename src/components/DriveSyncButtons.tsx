'use client';

import { useEffect, useState } from 'react';
import { GoogleAuthState, isGoogleConfigured, addAuthListener, getAuthState } from '@/lib/googleAuth';
import { saveInstructionsToDrive, loadInstructionsFromDrive, getTargetFolder, DriveFolder } from '@/lib/googleDrive';
import { getAllInstructions } from '@/lib/storage';
import { WorkInstruction } from '@/types/instruction';
import DriveFolderPicker from './DriveFolderPicker';

interface DriveSyncButtonsProps {
  onDataLoaded: (instructions: WorkInstruction[]) => void;
}

export default function DriveSyncButtons({ onDataLoaded }: DriveSyncButtonsProps) {
  const [auth, setAuth] = useState<GoogleAuthState>(getAuthState());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [targetFolder, setTargetFolderState] = useState<DriveFolder | null>(null);

  useEffect(() => { if (!isGoogleConfigured()) return; return addAuthListener(setAuth); }, []);
  useEffect(() => { setTargetFolderState(getTargetFolder()); }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [message]);

  if (!isGoogleConfigured() || !auth.isSignedIn) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const instructions = getAllInstructions();
      await saveInstructionsToDrive(instructions);
      setMessage({ text: `${instructions.length}件を「${targetFolder?.name || 'WorkInstructions'}」に保存しました`, type: 'success' });
    } catch {
      setMessage({ text: 'Driveへの保存に失敗しました', type: 'error' });
    } finally { setSaving(false); }
  };

  const handleLoad = async () => {
    if (!confirm('Driveのデータでローカルデータを上書きします。よろしいですか？')) return;
    setLoading(true);
    try {
      const data = await loadInstructionsFromDrive();
      if (data === null) { setMessage({ text: 'Driveにデータが見つかりません', type: 'error' }); return; }
      localStorage.setItem('work_instructions', JSON.stringify(data));
      onDataLoaded(data);
      setMessage({ text: `${data.length}件の手順書をDriveから読み込みました`, type: 'success' });
    } catch {
      setMessage({ text: 'Driveからの読み込みに失敗しました', type: 'error' });
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        <button onClick={() => setPickerOpen(true)}
          className="px-2 sm:px-3 py-1.5 text-[#6e6e73] border border-[#d2d2d7] rounded-full text-xs sm:text-sm hover:bg-[#f5f5f7] transition flex items-center gap-1.5"
          title={targetFolder ? `保存先: ${targetFolder.name}` : '保存先: WorkInstructions（デフォルト）'}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="max-w-[80px] sm:max-w-[120px] truncate">{targetFolder ? targetFolder.name : 'WorkInstructions'}</span>
        </button>
        <button onClick={handleSave} disabled={saving || loading}
          className="px-2 sm:px-3 py-1.5 text-[#1d1d1f] border border-[#d2d2d7] rounded-full text-xs sm:text-sm hover:bg-[#f5f5f7] transition disabled:opacity-50">
          {saving ? '保存中...' : 'Driveに保存'}
        </button>
        <button onClick={handleLoad} disabled={saving || loading}
          className="px-2 sm:px-3 py-1.5 text-[#1d1d1f] border border-[#d2d2d7] rounded-full text-xs sm:text-sm hover:bg-[#f5f5f7] transition disabled:opacity-50">
          {loading ? '読み込み中...' : 'Driveから読み込み'}
        </button>
        {message && (
          <span className={`text-xs sm:text-sm ${message.type === 'success' ? 'text-[#34c759]' : 'text-[#ff3b30]'}`}>
            {message.text}
          </span>
        )}
      </div>
      <DriveFolderPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={setTargetFolderState} />
    </>
  );
}
