'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import GoogleSignInButton from './GoogleSignInButton';
import DriveFolderPicker from './DriveFolderPicker';
import HelpModal from './HelpModal';
import { getTargetFolder, DriveFolder } from '@/lib/googleDrive';
import { isGoogleConfigured, getAuthState } from '@/lib/googleAuth';

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<DriveFolder | null>(null);

  useEffect(() => {
    setCurrentFolder(getTargetFolder());
  }, []);

  const handleFolderClick = () => {
    const auth = getAuthState();
    if (isGoogleConfigured() && auth.isSignedIn) {
      setShowFolderPicker(true);
    }
  };

  const handleFolderSelected = (folder: DriveFolder | null) => {
    setCurrentFolder(folder ?? getTargetFolder());
  };

  return (
    <>
      <header className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition">
            <span className="text-lg font-semibold tracking-tight">手順書作成システム</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setShowHelp(true)}
              className="px-2.5 py-1.5 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-white/10 transition"
              title="使い方ガイド"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition"
            >
              一覧
            </Link>
            <Link
              href="/instructions/new"
              className="px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium text-sm hover:from-blue-600 hover:to-indigo-600 transition shadow-sm"
            >
              + 新規作成
            </Link>
            <div className="ml-2 pl-2 border-l border-slate-700">
              <GoogleSignInButton />
            </div>
            {/* Drive folder selector */}
            <button
              onClick={handleFolderClick}
              className="px-3 py-1.5 rounded-lg text-sm border border-slate-600 hover:border-yellow-400 hover:bg-white/10 transition flex items-center gap-1.5 max-w-[180px]"
              title={currentFolder ? `保存先: ${currentFolder.name}` : 'Driveフォルダを指定'}
            >
              <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate text-slate-300">
                {currentFolder ? currentFolder.name : '未設定'}
              </span>
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden border-t border-slate-700/50 px-4 py-3 space-y-1 bg-slate-800/50">
            <button
              onClick={() => { setMenuOpen(false); setShowHelp(true); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              使い方ガイド
            </button>
            <Link
              href="/"
              className="block px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition"
              onClick={() => setMenuOpen(false)}
            >
              一覧
            </Link>
            <Link
              href="/instructions/new"
              className="block px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition"
              onClick={() => setMenuOpen(false)}
            >
              + 新規作成
            </Link>
            <div className="px-3 py-2">
              <GoogleSignInButton />
            </div>
            {/* Mobile Drive folder selector */}
            <button
              onClick={() => { setMenuOpen(false); handleFolderClick(); }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-white/10 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-yellow-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">
                {currentFolder ? `フォルダ: ${currentFolder.name}` : 'Driveフォルダを指定'}
              </span>
            </button>
          </nav>
        )}
      </header>

      {/* Help Modal */}
      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />

      {/* Drive Folder Picker Modal */}
      <DriveFolderPicker
        open={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
      />
    </>
  );
}
