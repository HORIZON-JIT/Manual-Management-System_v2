'use client';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">使い方ガイド</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 text-sm text-gray-700">

          {/* 基本の流れ */}
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full text-xs font-bold">1</span>
              基本の流れ
            </h3>
            <ol className="list-decimal list-inside space-y-1 ml-8">
              <li>トップページから<strong>「新規作成」</strong>をクリック</li>
              <li>タイトル・分類・概要を入力</li>
              <li>ステップを追加し、各ステップにタイトル・説明・画像を設定</li>
              <li><strong>「下書き保存」</strong>で一時保存、<strong>「完成」</strong>でGoogle Driveに保存</li>
            </ol>
          </section>

          {/* スクリーンショット撮影 */}
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-green-100 text-green-600 rounded-full text-xs font-bold">2</span>
              スクリーンショット撮影
            </h3>
            <p className="mb-2 ml-8">各ステップの画像セクションにある<strong className="text-green-600">「スクショ撮影」</strong>ボタンで画面をキャプチャできます。</p>
            <ol className="list-decimal list-inside space-y-1 ml-8">
              <li>緑色の「スクショ撮影」ボタンをクリック</li>
              <li>ブラウザのダイアログで共有する画面・ウィンドウ・タブを選択</li>
              <li>キャプチャされた画像が自動的にステップに追加されます</li>
            </ol>
            <div className="mt-2 ml-8 px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
              <strong>ヒント:</strong> OSのスクリーンショット機能（PrintScreen等）で撮影した後、ステップ内で <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs">V</kbd> で貼り付けることもできます。
            </div>
          </section>

          {/* 画像追加 */}
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold">3</span>
              画像の追加
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-8">
              <li><strong>「画像を追加」</strong>ボタンからファイルを選択（複数選択可）</li>
              <li>各画像にコメント（キャプション）を入力可能</li>
              <li>画像は自動的に圧縮されるため、サイズを気にする必要はありません</li>
            </ul>
          </section>

          {/* Google Drive連携 */}
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 text-yellow-600 rounded-full text-xs font-bold">4</span>
              Google Drive 連携
            </h3>
            <ol className="list-decimal list-inside space-y-1 ml-8">
              <li>ヘッダー右の<strong>「Google Drive」</strong>ボタンでサインイン</li>
              <li>フォルダアイコンをクリックして保存先フォルダを選択</li>
              <li>手順書を<strong>「完成」</strong>すると、ExcelとJSONがDriveに自動保存されます</li>
            </ol>
          </section>

          {/* 手順書の更新 */}
          <section>
            <h3 className="text-base font-bold text-slate-800 mb-2 flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full text-xs font-bold">5</span>
              手順書の更新
            </h3>
            <ol className="list-decimal list-inside space-y-1 ml-8">
              <li>トップページの<strong>「手順書更新」</strong>をクリック</li>
              <li>DriveからJSONファイルを選択</li>
              <li>編集画面が開くので、内容を修正して再度「完成」で上書き保存</li>
            </ol>
          </section>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-white bg-slate-700 hover:bg-slate-800 rounded-lg transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
