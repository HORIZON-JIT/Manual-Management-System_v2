'use client';

import { useEffect, useState, useCallback } from 'react';
import { DriveFolder, DriveLocation, listFolders, listSharedDrives, listSharedWithMeFolders, createNewFolder, getTargetFolder, setTargetFolder } from '@/lib/googleDrive';

interface DriveFolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (folder: DriveFolder | null) => void;
}

interface BreadcrumbItem { id: string | undefined; name: string; }

const LOCATION_LABELS: Record<DriveLocation, string> = {
  'my-drive': 'マイドライブ',
  'shared-drives': '共有ドライブ',
  'shared-with-me': '共有アイテム',
};

export default function DriveFolderPicker({ open, onClose, onSelect }: DriveFolderPickerProps) {
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<DriveLocation>('my-drive');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: undefined, name: 'マイドライブ' }]);
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [currentDriveId, setCurrentDriveId] = useState<string | undefined>(undefined);
  const [isSharedDrivesList, setIsSharedDrivesList] = useState(false);
  const currentParentId = breadcrumbs[breadcrumbs.length - 1].id;

  const loadFolderList = useCallback(async (parentId?: string, driveId?: string) => {
    setLoading(true);
    try { setFolders(await listFolders(parentId, driveId ? { driveId } : undefined)); }
    catch { setFolders([]); } finally { setLoading(false); }
  }, []);

  const loadSharedDrives = useCallback(async () => {
    setLoading(true);
    try { setFolders(await listSharedDrives()); }
    catch { setFolders([]); } finally { setLoading(false); }
  }, []);

  const loadSharedWithMe = useCallback(async () => {
    setLoading(true);
    try { setFolders(await listSharedWithMeFolders()); }
    catch { setFolders([]); } finally { setLoading(false); }
  }, []);

  const switchLocation = useCallback((loc: DriveLocation) => {
    setLocation(loc); setCurrentDriveId(undefined); setIsSharedDrivesList(false);
    setBreadcrumbs([{ id: undefined, name: LOCATION_LABELS[loc] }]);
    if (loc === 'shared-drives') setIsSharedDrivesList(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLocation('my-drive'); setCurrentDriveId(undefined); setIsSharedDrivesList(false);
    setBreadcrumbs([{ id: undefined, name: 'マイドライブ' }]);
    loadFolderList(undefined);
  }, [open, loadFolderList]);

  useEffect(() => {
    if (!open) return;
    if (location === 'my-drive') loadFolderList(undefined);
    else if (location === 'shared-drives') loadSharedDrives();
    else if (location === 'shared-with-me') loadSharedWithMe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const navigateInto = (folder: DriveFolder) => {
    if (isSharedDrivesList) {
      setIsSharedDrivesList(false); setCurrentDriveId(folder.id);
      setBreadcrumbs([{ id: undefined, name: LOCATION_LABELS['shared-drives'] }, { id: folder.id, name: folder.name }]);
      loadFolderList(folder.id, folder.id); return;
    }
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolderList(folder.id, currentDriveId);
  };

  const navigateTo = (index: number) => {
    const newBc = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newBc);
    const targetId = newBc[newBc.length - 1].id;
    if (location === 'shared-drives' && index === 0) { setIsSharedDrivesList(true); setCurrentDriveId(undefined); loadSharedDrives(); }
    else if (location === 'shared-with-me' && index === 0) loadSharedWithMe();
    else loadFolderList(targetId, currentDriveId);
  };

  const handleSelectCurrent = () => {
    const current = breadcrumbs[breadcrumbs.length - 1];
    if (!current.id) { setTargetFolder(null); onSelect(null); }
    else { const folder = { id: current.id, name: current.name }; setTargetFolder(folder); onSelect(folder); }
    onClose();
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    try {
      const created = await createNewFolder(newFolderName.trim(), currentParentId);
      setNewFolderName('');
      if (isSharedDrivesList) await loadSharedDrives();
      else if (location === 'shared-with-me' && !currentParentId) await loadSharedWithMe();
      else await loadFolderList(currentParentId, currentDriveId);
      navigateInto(created);
    } catch { /* ignore */ } finally { setCreating(false); }
  };

  const handleReset = () => { setTargetFolder(null); onSelect(null); onClose(); };
  const currentTarget = getTargetFolder();

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#e8e8ed]">
          <h3 className="text-base font-semibold text-[#1d1d1f]">保存先フォルダを選択</h3>
          {currentTarget && (
            <p className="text-xs text-[#86868b] mt-0.5">
              現在の保存先: <span className="font-medium text-[#1d1d1f]">{currentTarget.name}</span>
            </p>
          )}
        </div>

        {/* Location tabs */}
        <div className="px-4 py-2.5 border-b border-[#e8e8ed] flex gap-1.5">
          {(['my-drive', 'shared-drives', 'shared-with-me'] as DriveLocation[]).map((loc) => (
            <button key={loc} onClick={() => switchLocation(loc)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition ${location === loc ? 'bg-[#0071e3] text-white' : 'text-[#6e6e73] hover:bg-[#f5f5f7]'}`}>
              {LOCATION_LABELS[loc]}
            </button>
          ))}
        </div>

        {/* Breadcrumbs */}
        <div className="px-4 py-2 border-b border-[#e8e8ed] flex items-center gap-1 text-sm overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              {i > 0 && <span className="text-[#d2d2d7]">/</span>}
              <button onClick={() => navigateTo(i)}
                className={`transition ${i === breadcrumbs.length - 1 ? 'font-medium text-[#1d1d1f]' : 'text-[#6e6e73] hover:text-[#0071e3]'}`}>
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Folder list */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-[#86868b] text-sm">読み込み中...</div>
          ) : folders.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[#86868b] text-sm">
              {isSharedDrivesList ? '共有ドライブがありません' : 'フォルダがありません'}
            </div>
          ) : (
            <ul className="space-y-0.5">
              {folders.map((folder) => (
                <li key={folder.id}>
                  <button onClick={() => navigateInto(folder)}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-[#f5f5f7] flex items-center gap-2 text-sm transition">
                    <span className="text-lg">{isSharedDrivesList ? '🖥️' : '📁'}</span>
                    <span className="text-[#1d1d1f] truncate">{folder.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* New folder */}
        {!isSharedDrivesList && (
          <div className="px-4 py-2.5 border-t border-[#e8e8ed]">
            <div className="flex items-center gap-2">
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                placeholder="新しいフォルダ名..."
                className="flex-1 border border-[#d2d2d7] rounded-xl px-3 py-1.5 text-sm text-[#1d1d1f] placeholder:text-[#86868b] focus:ring-2 focus:ring-[#0071e3] focus:border-[#0071e3] outline-none" />
              <button onClick={handleCreateFolder} disabled={creating || !newFolderName.trim()}
                className="px-4 py-1.5 bg-[#0071e3] text-white rounded-full text-sm font-medium hover:bg-[#0077ed] transition disabled:opacity-50">
                {creating ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 py-3.5 border-t border-[#e8e8ed] flex items-center justify-between gap-2">
          <button onClick={handleReset} className="text-xs text-[#6e6e73] hover:text-[#1d1d1f] transition underline">
            デフォルトに戻す
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-[#6e6e73] hover:text-[#1d1d1f] transition">
              キャンセル
            </button>
            <button onClick={handleSelectCurrent} disabled={isSharedDrivesList}
              className="px-4 py-2 bg-[#0071e3] text-white rounded-full text-sm font-medium hover:bg-[#0077ed] transition disabled:opacity-50">
              このフォルダを選択
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
