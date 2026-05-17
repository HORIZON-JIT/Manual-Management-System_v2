'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { WorkInstruction } from '@/types/instruction';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';
import { DriveFileInfo } from '@/lib/googleDrive';
import DriveJsonFilePicker from '@/components/DriveJsonFilePicker';
import { setTempData } from '@/lib/tempStorage';

const actions = [
  {
    href: '/instructions/new',
    title: '新規作成',
    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />,
  },
  {
    href: '/instructions/drafts',
    title: '下書きから編集',
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    ),
  },
];

export default function HomePage() {
  const router = useRouter();
  const [importError, setImportError] = useState<string | null>(null);
  const [showJsonPicker, setShowJsonPicker] = useState(false);
  const [showPreviewPicker, setShowPreviewPicker] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    fetch('https://api.github.com/repos/HORIZON-JIT/FC/pulls?state=closed&per_page=1', {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
      .then((res) => {
        const link = res.headers.get('Link') ?? '';
        const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
        if (match) setVersion(`1.${match[1]}`);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!importError) return;
    const timer = setTimeout(() => setImportError(null), 5000);
    return () => clearTimeout(timer);
  }, [importError]);

  const ensureDriveReady = () => {
    const auth = getAuthState();
    if (isGoogleConfigured() && auth.isSignedIn) return true;
    setImportError(
      'Google Drive に接続してください。右上のサインインボタンからログインできます。',
    );
    return false;
  };

  const handleUpdateClick = () => {
    if (ensureDriveReady()) setShowJsonPicker(true);
  };

  const handlePreviewClick = () => {
    if (ensureDriveReady()) setShowPreviewPicker(true);
  };

  const handlePreviewFileLoaded = async (content: string, file: DriveFileInfo) => {
    try {
      const json = JSON.parse(content);
      if (!json.id || !json.title || !json.steps || !Array.isArray(json.steps)) {
        throw new Error('有効な手順書データではありません。');
      }
      await setTempData(
        'preview_instruction',
        JSON.stringify({ ...json, driveFileId: file.id }),
      );
      router.push('/instructions/view?source=preview');
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : `${file.name} の読み込みに失敗しました。`,
      );
    }
  };

  const handleJsonFileLoaded = async (content: string, file: DriveFileInfo) => {
    try {
      const json = JSON.parse(content);
      if (!json.id || !json.title || !json.steps || !Array.isArray(json.steps)) {
        throw new Error('有効な手順書データではありません。');
      }
      const instruction = { ...(json as WorkInstruction), driveFileId: file.id };
      instruction.status = 'completed';
      await setTempData('drive_import_instruction', JSON.stringify(instruction));
      router.push('/instructions/edit?source=drive');
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : `${file.name} の読み込みに失敗しました。`,
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-76px)] max-w-7xl flex-col px-6 py-8 lg:py-10">
      <section className="border-b border-neutral-200 pb-8">
        <div className="max-w-3xl">
          <div className="mb-5 h-px w-16 bg-[#a48149]" />
          <p className="mb-4 text-xs font-semibold tracking-[0.28em] text-[#8a6a37]">HORIZON JIT</p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.03] tracking-[-0.03em] text-neutral-950 sm:text-5xl">
            Manual Management
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-7 text-neutral-600">
            業務手順を、作成から保存・共有まで静かに整えるためのワークスペースです。
          </p>
        </div>
      </section>

      <section className="mt-7 grid w-full flex-none gap-2 self-start rounded-lg border border-neutral-200 bg-white/70 p-2 shadow-[0_18px_44px_rgba(0,0,0,0.06)] sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="group flex min-h-24 items-center gap-4 rounded-md px-4 py-4 transition hover:bg-[#f7f3ec]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition group-hover:border-[#a48149]/50 group-hover:text-[#8a6a37]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {action.icon}
              </svg>
            </div>
            <h2 className="text-base font-semibold leading-6 text-neutral-950">{action.title}</h2>
          </Link>
        ))}

        <button
          type="button"
          onClick={handleUpdateClick}
          className="group flex min-h-24 items-center gap-4 rounded-md px-4 py-4 text-left transition hover:bg-[#f7f3ec]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition group-hover:border-[#a48149]/50 group-hover:text-[#8a6a37]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <h2 className="text-base font-semibold leading-6 text-neutral-950">
            <span className="block">Driveの手順書を</span>
            <span className="block">編集</span>
          </h2>
        </button>

        <button
          type="button"
          onClick={handlePreviewClick}
          className="group flex min-h-24 items-center gap-4 rounded-md px-4 py-4 text-left transition hover:bg-[#f7f3ec]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 transition group-hover:border-[#a48149]/50 group-hover:text-[#8a6a37]">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold leading-6 text-neutral-950">
            <span className="block">Driveの手順書を</span>
            <span className="block">表示</span>
          </h2>
        </button>
      </section>

      {importError && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5 text-xs text-neutral-400">
        <p>Developed by Yuma Tani</p>
        <div className="flex items-center gap-3">
          <span>Build 2026</span>
          {version && <span>Version {version}</span>}
        </div>
      </footer>

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
