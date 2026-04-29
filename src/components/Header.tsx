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
      <header className="bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-70 transition-opacity">
            <span className="text-base font-semibold text-[#1d1d1f] tracking-tight">手順書作成システム</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1.5">
            <button
              onClick={() => setShowHelp(true)}
              className="p-2 rounded-full text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition"
              title="使い方ガイド"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-full text-sm text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition"
            >
              一覧
            </Link>
            <Link
              href="/instructions/new"
              className="px-4 py-1.5 bg-[#0071e3] hover:bg-[#0077ed] text-white rounded-full font-medium text-sm transition"
            >
              + 新規作成
            </Link>
            <div className="ml-1 pl-2 border-l border-[#e8e8ed]">
              <GoogleSignInButton />
            </div>
            <button
              onClick={handleFolderClick}
              className="px-3 py-1.5 rounded-full text-sm border border-[#d2d2d7] hover:border-[#0071e3] hover:bg-black/5 transition flex items-center gap-1.5 max-w-[180px] text-[#6e6e73]"
              title={currentFolder ? `保存先: ${currentFolder.name}` : 'Driveフォルダを指定'}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">
                {currentFolder ? currentFolder.name : '未設定'}
              </span>
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-black/5 transition text-[#1d1d1f]"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="メニュー"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <nav className="md:hidden border-t border-[#e8e8ed] px-4 py-3 space-y-1 bg-white">
            <button
              onClick={() => { setMenuOpen(false); setShowHelp(true); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              使い方ガイド
            </button>
            <Link
              href="/"
              className="block px-3 py-2.5 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition"
              onClick={() => setMenuOpen(false)}
            >
              一覧
            </Link>
            <Link
              href="/instructions/new"
              className="block px-3 py-2.5 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition"
              onClick={() => setMenuOpen(false)}
            >
              + 新規作成
            </Link>
            <div className="px-3 py-2">
              <GoogleSignInButton />
            </div>
            <button
              onClick={() => { setMenuOpen(false); handleFolderClick(); }}
              className="w-full text-left px-3 py-2.5 rounded-xl text-sm text-[#6e6e73] hover:text-[#1d1d1f] hover:bg-black/5 transition flex items-center gap-2"
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span className="truncate">
                {currentFolder ? `フォルダ: ${currentFolder.name}` : 'Driveフォルダを指定'}
              </span>
            </button>
          </nav>
        )}
      </header>

      <HelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      <DriveFolderPicker
        open={showFolderPicker}
        onClose={() => setShowFolderPicker(false)}
        onSelect={handleFolderSelected}
      />
    </>
  );
}
