'use client';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const sections = [
  {
    id: 'overview',
    badge: '1',
    color: 'bg-blue-100 text-blue-700',
    title: 'このアプリでできること',
    items: [
      '業務手順書を新規作成し、下書き保存しながら編集できます。',
      '画像付きの手順、条件分岐、チェック項目、関連リンク、ジャンプ付きの手順をまとめられます。',
      '完成した手順書は Google Drive に JSON として保存でき、必要に応じて Excel も出力できます。',
      '保存済みの手順書は Drive から再編集・閲覧でき、閲覧画面ではフロー図や更新履歴も確認できます。',
    ],
  },
  {
    id: 'header',
    badge: '2',
    color: 'bg-amber-100 text-amber-700',
    title: '画面上部の使い方',
    items: [
      '「?」ボタン: この説明書を開きます。',
      '「ホーム」: トップページへ戻ります。',
      '「新規作成」: 手順書の作成画面を開きます。',
      '「Google Drive」: Google アカウントでサインインします。Drive の保存・読込・閲覧前に必要です。',
      'フォルダボタン: 保存先フォルダを選びます。マイドライブ、共有ドライブ、共有アイテムから選択でき、新しいフォルダ作成もできます。',
    ],
  },
  {
    id: 'home',
    badge: '3',
    color: 'bg-emerald-100 text-emerald-700',
    title: 'トップページの各機能',
    items: [
      '「新規作成」: 空の状態から新しい手順書を作ります。',
      '「下書きから編集」: ブラウザ内に保存した下書き一覧を開き、再開・削除できます。JSON ファイルの読み込みもここから行えます。',
      '「Drive の手順書を編集」: 保存先フォルダ内の JSON を選び、その内容を編集画面に読み込みます。',
      '「Drive の手順書を表示」: 保存先フォルダ内の JSON を選び、閲覧用画面で表示します。',
    ],
  },
  {
    id: 'basic',
    badge: '4',
    color: 'bg-violet-100 text-violet-700',
    title: '手順書の基本情報',
    items: [
      'タイトル: 手順書名です。完成保存時は必須です。',
      'カテゴリ: 既定のカテゴリを選ぶか、「追加」で独自カテゴリを作れます。',
      '作成者名 / 更新者名: 完成保存時に必須です。前回入力した名前は再利用されます。',
      '概要: 手順書の目的や対象業務を記載します。',
      'キーワード: カンマまたはスペース区切りで登録できます。閲覧時にも表示されます。',
      '更新履歴に追記する: 編集時にチェックすると、変更前の内容を版として残し、更新メモも付けられます。',
    ],
  },
  {
    id: 'conditions',
    badge: '5',
    color: 'bg-cyan-100 text-cyan-700',
    title: '条件分岐の設定',
    items: [
      'グループを追加すると、条件ごとに分岐する手順をまとめて管理できます。',
      '各グループの中に条件を複数追加し、各ステップに「どの条件で表示するか」を割り当てます。',
      '親条件を設定すると、ある条件を選んだときだけ次の分岐グループを表示する構成にできます。',
      '条件を付けていないステップは共通ステップとして、すべての条件で表示されます。',
    ],
  },
  {
    id: 'steps',
    badge: '6',
    color: 'bg-rose-100 text-rose-700',
    title: 'ステップ編集の詳細',
    items: [
      '各ステップでは、タイトル、説明、注意事項を入力できます。',
      'ステップは上下移動、途中挿入、削除ができます。最低 1 ステップは必要です。',
      '画像は「画像を追加」で複数登録でき、自動圧縮されます。コメント入力、並び替え、削除にも対応しています。',
      '「スクショ撮影」では画面共有からそのまま画像を取り込めます。OS のスクリーンショットを Ctrl+V で貼り付けることもできます。',
      '画像の「注釈」から、画像へ追記した版を作れます。必要なら元画像へ戻せます。',
      '関連リンクには、他の手順書へのリンクと通常の URL を追加できます。',
      '条件付きジャンプを使うと、「NG の場合はステップ 7 へ」のような移動先を設定できます。',
      'チェック項目を追加すると、閲覧時に確認用のチェックボックスとして使えます。',
      '通常進行ラベルは、分岐がない通常ルート名として利用するためのラベルです。',
    ],
  },
  {
    id: 'save',
    badge: '7',
    color: 'bg-yellow-100 text-yellow-700',
    title: '保存と出力',
    items: [
      '「下書き保存して継続」: ブラウザ内に一時保存し、そのまま編集を続けます。',
      '「下書き保存して終了」: ブラウザ内に保存して、下書き一覧へ戻ります。',
      '「完成して Drive へ保存」: 選択済みの Drive フォルダへ JSON を保存します。Google サインインと保存先設定が必要です。',
      'Excel 出力を有効にすると、完成保存時に Google スプレッドシートも合わせて保存されます。',
      '「ステップ別シート」はシートを分けた構成、「スクロール」は従来型の縦長構成です。',
      '「読み飛ばし防止モード」を有効にすると、閲覧時は「次へ」で 1 ステップずつ表示されます。',
      '「JSON で保存」: Drive ではなく手元に JSON ファイルとして書き出します。',
    ],
  },
  {
    id: 'drafts',
    badge: '8',
    color: 'bg-lime-100 text-lime-700',
    title: '下書き一覧と Drive 読み込み',
    items: [
      '下書き一覧では、保存済みの下書きを再開・削除できます。',
      '下書きが複数ある場合は「すべて削除」でブラウザ保存分をまとめて消せます。',
      'JSON から読み込むと、手元の JSON ファイルを編集画面へ取り込めます。',
      'Drive から編集・表示するときは、保存先フォルダ内の JSON 一覧が開き、更新日・作成者・更新者で絞り込みできます。',
    ],
  },
  {
    id: 'view',
    badge: '9',
    color: 'bg-slate-200 text-slate-700',
    title: '閲覧画面でできること',
    items: [
      '手順書のタイトル、概要、カテゴリ、作成日、更新日、キーワードを確認できます。',
      '条件分岐がある手順書では、条件ボタンを切り替えて該当ルートだけ表示できます。',
      '読み飛ばし防止モードが有効な手順書は、順番に 1 ステップずつ進めて閲覧します。',
      '「アプリ閲覧 URL」で、このアプリ内の閲覧用リンクをコピーできます。',
      '「更新履歴」では過去版を表示でき、「フロー図」では手順全体を図で確認できます。',
      '「印刷」で紙や PDF 用に出力できます。共有表示やプレビュー表示でない場合は「編集」ボタンも使えます。',
      'Drive 上の手順書を開く場合は、Google ログイン済みである必要があります。',
    ],
  },
  {
    id: 'tips',
    badge: '10',
    color: 'bg-neutral-200 text-neutral-700',
    title: '使うときのポイント',
    items: [
      'Drive 操作ができないときは、先に Google Drive ボタンでサインインしてください。',
      '完成保存でエラーになるときは、保存先フォルダが未設定のことが多いので、右上のフォルダボタンを確認してください。',
      '下書きはブラウザ内保存なので、別の PC や別ブラウザには自動では引き継がれません。残したい場合は完成保存か JSON 保存を使うと安心です。',
      '画像が多いとブラウザ保存容量に近づくことがあるため、不要な下書きは定期的に整理してください。',
    ],
  },
];

export default function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-[#fcfbf8] shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-neutral-200 px-6 py-5 sm:px-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#9a7a45]">
                HELP GUIDE
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
                手順書作成システム 使い方ガイド
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-500">
                トップ画面、作成画面、Drive 連携、閲覧画面まで、このアプリで使える機能をまとめています。
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-400 transition hover:text-neutral-700"
              aria-label="閉じる"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {sections.map((section) => (
              <section
                key={section.id}
                className="rounded-2xl border border-neutral-200 bg-white px-5 py-5 shadow-sm"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${section.color}`}
                  >
                    {section.badge}
                  </span>
                  <h3 className="text-base font-semibold text-neutral-900">{section.title}</h3>
                </div>
                <ul className="space-y-2.5 pl-5 text-sm leading-6 text-neutral-600">
                  {section.items.map((item) => (
                    <li key={item} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </div>

        <div className="border-t border-neutral-200 px-6 py-4 sm:px-8">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
