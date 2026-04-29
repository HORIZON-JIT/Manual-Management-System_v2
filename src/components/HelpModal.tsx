'use client';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8e8ed]">
          <h2 className="text-lg font-semibold text-[#1d1d1f]">使い方ガイド</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f5f5f7] text-[#6e6e73] hover:text-[#1d1d1f] transition text-xl leading-none">
            &times;
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-[#1d1d1f]">
          {[
            {
              num: 1, label: '基本の流れ',
              content: (
                <ol className="list-decimal list-inside space-y-1 ml-8 text-[#6e6e73]">
                  <li>トップページから<strong className="text-[#1d1d1f]">「新規作成」</strong>をクリック</li>
                  <li>タイトル・分類・概要を入力</li>
                  <li>ステップを追加し、各ステップにタイトル・説明・画像を設定</li>
                  <li><strong className="text-[#1d1d1f]">「下書き保存」</strong>で一時保存、<strong className="text-[#1d1d1f]">「完成」</strong>でGoogle Driveに保存</li>
                </ol>
              ),
            },
            {
              num: 2, label: 'スクリーンショット撮影',
              content: (
                <div className="ml-8 space-y-2 text-[#6e6e73]">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>「スクショ撮影」ボタンをクリック</li>
                    <li>ブラウザのダイアログで共有する画面・ウィンドウ・タブを選択</li>
                    <li>キャプチャされた画像が自動的にステップに追加されます</li>
                  </ol>
                  <div className="px-3 py-2 bg-[#f5f5f7] rounded-xl text-xs text-[#6e6e73]">
                    <strong className="text-[#1d1d1f]">ヒント:</strong> OSのスクリーンショット機能で撮影後、ステップ内で <kbd className="px-1.5 py-0.5 bg-white border border-[#d2d2d7] rounded text-xs">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white border border-[#d2d2d7] rounded text-xs">V</kbd> で貼り付けることもできます。
                  </div>
                </div>
              ),
            },
            {
              num: 3, label: '画像の追加',
              content: (
                <ul className="list-disc list-inside space-y-1 ml-8 text-[#6e6e73]">
                  <li><strong className="text-[#1d1d1f]">「画像を追加」</strong>ボタンからファイルを選択（複数選択可）</li>
                  <li>各画像にコメント（キャプション）を入力可能</li>
                  <li>画像は自動的に圧縮されるため、サイズを気にする必要はありません</li>
                </ul>
              ),
            },
            {
              num: 4, label: 'Google Drive 連携',
              content: (
                <ol className="list-decimal list-inside space-y-1 ml-8 text-[#6e6e73]">
                  <li>ヘッダー右の<strong className="text-[#1d1d1f]">「Google Drive」</strong>ボタンでサインイン</li>
                  <li>フォルダアイコンをクリックして保存先フォルダを選択</li>
                  <li>手順書を<strong className="text-[#1d1d1f]">「完成」</strong>すると、スプレッドシートとJSONがDriveに自動保存されます</li>
                </ol>
              ),
            },
            {
              num: 5, label: '手順書の更新',
              content: (
                <ol className="list-decimal list-inside space-y-1 ml-8 text-[#6e6e73]">
                  <li>トップページの<strong className="text-[#1d1d1f]">「手順書更新」</strong>をクリック</li>
                  <li>DriveからJSONファイルを選択</li>
                  <li>編集画面が開くので、内容を修正して再度「完成」で上書き保存</li>
                </ol>
              ),
            },
          ].map(({ num, label, content }) => (
            <section key={num}>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-2.5 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-[#0071e3] text-white rounded-full text-xs font-bold shrink-0">{num}</span>
                {label}
              </h3>
              {content}
            </section>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#e8e8ed] flex justify-end">
          <button onClick={onClose}
            className="px-5 py-2 text-sm text-white bg-[#0071e3] hover:bg-[#0077ed] rounded-full transition font-medium">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
