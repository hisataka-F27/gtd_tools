# 実行計画 — P0（#10 バックアップ / #2 取り消し / #1 キーボード操作）

対象は [ROADMAP.md](ROADMAP.md) の P0 3件。実装は Sonnet が行う前提で、
判断が要るところは先に決めてある。**決めてあることは勝手に変えない。
変える必要が出たら、変えずに止めて報告する。**

前提: main = `543055e` / `node --test 'test/*.test.js'` が 118 pass 0 fail。

---

## 0. 全ステップ共通のルール

1. **`GTDタスク管理ツール.html` を直接編集しない。** 生成物である。
   `src/` を編集して `node build.js` で作り直す。
2. テストは `node --test 'test/*.test.js'`。
   （`node --test test/` は Node v26 では動かない。グロブ必須）
3. **ソースの書き換えには Edit ツールを使う。**
   python heredoc による一括置換は、このリポジトリで
   「エラーを出さずに何も置換しない」失敗を過去2回起こしている。
4. ステップごとに専用ブランチを切り、main へ `--no-ff` でマージする。
   マージ前に必ず `node build.js` → `git status --short` が空 →
   `node --test 'test/*.test.js'` が全 pass、を確認する。
5. **`test/phase4-actions-equivalence.test.js` を消さない・skip しない。**
   30-actions.js の既存関数の中身を変えたら、変更点を
   `[before, after]` の置換ルールとして同ファイルに宣言する
   （`PADD_REFOCUS` / `ETPL_NULL_GUARD` などが先例。ファイル内のコメントに禁止事項の記載あり）。
   宣言を足したら、**必ずミューテーションテストを1回行う**
   （新しいコードを1箇所わざと壊して FAIL することを確認し、元に戻す）。
   網が緩んでいないことの確認であり、これをやらずに「通りました」と報告しない。
6. **ブラウザでの目視確認について。** プレビューペインは `file://` をサンドボックス化した
   `data:` オリジンで開くため、**localStorage が例外を投げ、状態が呼び出し間で持ち越される**。
   ここで得た結果は信用しない。1シナリオは1回の実行にまとめ、
   保存が絡む確認は「ユーザに実ファイルで確認してもらう項目」として報告に書く。
7. 各ステップ完了時に README.md の該当箇所と ROADMAP.md の「対応済み」表を更新する。
8. `REFACTOR_PLAN.md` は履歴として凍結する。追記しない。

実装順は **A（#10）→ B（#2）→ C（#1）** で固定する。理由:
A は他に触らず単独で閉じ、失われるものが最大の部分を先に守れる。
C の `x`（1キーで完了）は B の取り消しがあって初めて安心して押せる。

---

## ステップA — #10 世代バックアップ

### 決めてあること

- 退避先は localStorage の追加2キー。
  - `KEY + ".bak"` … 退避した db の JSON 文字列（`KEY` は `minamo.gtd.v1`）
  - `KEY + ".bak.at"` … 退避した日（`"YYYY-MM-DD"`）
- **退避のタイミングは「起動時、1日1回」。**
  `load()` が既存データの `JSON.parse` に成功し `db` に採用した直後、
  `.bak.at` が今日でなければ、**parse 済みの生文字列 `raw` をそのまま** `.bak` に書き、
  `.bak.at` に `today()` を書く。
  - なぜ生文字列か: 「読めることが確認済みの内容」だけを退避でき、
    normalize() や以降の操作の影響を受けない。
  - なぜ1日1回か: 保存のたびに退避すると容量が2倍で増え続ける。
    「その日を開いた時点の状態」に戻せれば実用上足りる。
- 書き込みは try/catch で囲み、**失敗しても何も起きない**（エラーバーも出さない）。
  失敗時は `.bak.at` を更新しない＝次回起動で再試行される。
- 復元の入口は設定パネル（[16-view-edit.js:65](src/js/16-view-edit.js:65) `renderSettings`）の末尾に
  「バックアップ」セクションを足す。
  - 退避があるとき: 退避日（`fmtDate`）と項目数、`#bakRestore`「この状態に戻す」ボタン。
  - 無いとき: 「まだ退避がありません（次回この画面を開いた日に作られます）」。
- 復元は `ask()` で確認してから実行。確認文に退避日と項目数を含める。
  `db` を差し替え → `normalize()` → `save()` → `closePanel()` → `renderAll()`。
- 起動時に保存データが壊れて読めなかった場合
  （[04-store.js](src/js/04-store.js) の `showError("保存データ", ...)` の分岐）、
  退避が存在するならメッセージにその旨と退避日を追記する。

### やること

1. `src/js/04-store.js`
   - `const BAK_KEY = KEY + ".bak"`, `const BAK_AT_KEY = KEY + ".bak.at"`
   - `function shouldRotateBackup(bakAt, todayStr)` … `bakAt !== todayStr` を返すだけの純関数。
     `bakAt` が null / 不正値でも true。**テストのためにこれを関数として切り出す。**
   - `function rotateBackup(s, raw)` … 上のルールで退避する。try/catch 内。
   - `function readBackup()` … `{json, at, count}` か null を返す。parse 失敗は null 扱い。
   - `load()` から `rotateBackup()` を呼ぶ。呼ぶ位置は `normalize()` の**前**
     （normalize が db を書き換える前の生文字列を退避するため）。
   - テスト用エクスポートに `shouldRotateBackup, readBackup, BAK_KEY, BAK_AT_KEY` を追加。
2. `src/js/16-view-edit.js` … `renderSettings()` にバックアップセクションを追加。
   埋め込みは必ず `html`` ` を通す（生の文字列連結を書かない）。
3. `src/js/30-actions.js` … `function restoreBackup()` を新規追加。
   **既存関数には手を触れない**（＝等価性テストの置換ルール追加は不要のはず）。
   テスト用エクスポートに追加。
4. `src/js/40-events.js` … `CLICK_ROUTES` に
   `{ match: e => e.target.id==="bakRestore" ? e.target : null, run: () => restoreBackup() }` を追加。
   位置は項目編集ブロックの手前あたり、id 直接一致同士なので順序の意味は無いが、
   設定まわり（`appSave` の近く）に置いて読みやすさを揃える。
5. `test/store-backup.test.js` を新規作成。
   `shouldRotateBackup` の 同日 / 別日 / null / 不正文字列 の4ケース。

### 完了の定義

- 全テスト pass（既存118 + 新規4）。
- `node build.js` 後に `git status --short` が空。
- ユーザ確認用の手順を報告に書く（下記スモークはユーザに依頼する項目）:
  1. 実ファイルを開く → 項目を数件足す → 閉じる。
  2. 翌日（または devtools で `.bak.at` を古い日付に書き換えて）開き直す → 設定に退避日が出る。
  3. 項目をいくつか消してから「この状態に戻す」→ 消す前に戻る。

---

## ステップB — #2 取り消し（Undo）

### 決めてあること

- **方式は db 丸ごとのスナップショット。** 差分方式は取らない
   （db は数百KB規模で、丸ごとコピーで十分速く、実装ミスの余地が桁違いに小さい）。
- 保持は**最大10件のスタック**。それを超えたら古い方から捨てる。
- 新規ファイル `src/js/08-undo.js` を作る（07-html の後、ビュー群の前）。
  ここに載せる関数:

  | 関数 | 役割 | DOM に触るか |
  |---|---|---|
  | `pushUndo(label)` | 現在の db を JSON 文字列にしてスタックへ積む | 触らない |
  | `popUndo()` | 直近を取り出して db オブジェクトに戻して返す（無ければ null） | 触らない |
  | `undoDepth()` | スタックの深さ | 触らない |
  | `resetUndo()` | スタックを空にする（テスト用） | 触らない |
  | `snapshot(label)` | `pushUndo` + トースト表示 | 触る |
  | `undoLast()` | `popUndo` → db 差し替え → normalize → save → closePanel → renderAll → トースト | 触る |
  | `showToast(msg, opts)` | トーストの表示（8秒で自動的に消える） | 触る |

  **DOM に触る関数と触らない関数を必ずこの形で分ける。** テストは前者だけを対象にする。
- トーストは `#toast` を `index.html` の `#overlay` の直後に置き、CSS は
  `src/styles/70-toast.css` を新規作成（ファイル名順で読まれるので 60-review と 90-responsive の間）。
  中身は「メッセージ + `[data-undo]` の『取り消す』ボタン」。取り消し不可の通知にも使えるよう、
  ボタンの有無は `showToast` の引数で切り替える（#5 の布石。今回は使わない）。
- `Cmd+Z` / `Ctrl+Z` で取り消す。**入力欄にフォーカスがあるときは何もしない**
  （テキストの取り消しはブラウザ標準に任せる）。判定は既存の `n` / `/` ルートと同じ
  `/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)` を使う。
- **`snapshot()` を呼ぶ場所は以下で確定。ここに無いものには足さない。**

  | 関数 | ラベル |
  |---|---|
  | `deleteItem` | 項目の削除 |
  | `deleteProject` | プロジェクトの削除 |
  | `deleteContext` | コンテキストの削除 |
  | `deleteTemplate` | 定型の削除 |
  | `toggleItemDone` | 完了の切り替え |
  | `completeItem` | 完了にする |
  | `reopenItem` | 未完に戻す |
  | `completeProject` | プロジェクトの完了 |
  | `saveItemEdit` | 項目の変更 |
  | `saveProject` | プロジェクトの変更 |
  | `renameContext` | コンテキスト名の変更 |
  | `runAllPendingTemplates` | 定型の一括投入 |
  | `clarSubmit`（15-view-clarify.js） | 明確化 |
  | `importJSON`（04-store.js） | 読み込み |
  | `restoreBackup`（ステップA） | バックアップからの復元 |

  入れない理由（報告に書くこと）: `capture` / `addProjectAction` / `addContextNew` /
  `saveTemplate` / `runTemplate` / `moveContext` / `saveAppName` は
  「作る・並べ替えるだけ」で、画面を見れば自力で戻せる。取り消し履歴を汚す方が害が大きい。
- **`snapshot()` を置く位置は「変更が確定する直前」。**
  早期 return や `ask()` のキャンセルより後に置く。
  例: `deleteItem` は `if(!ask(...)) return;` の**次の行**。
- 削除の確認ダイアログは**今回は残す**。取り消しが定着してから減らすか判断する
   （スコープを広げない）。

### やること

1. `src/js/08-undo.js` 新規作成（上表の関数 + テスト用エクスポート）。
2. `src/index.html` に `<div id="toast" class="hide"></div>` を追加。
3. `src/styles/70-toast.css` 新規作成。既存のトークン（`src/styles/00-tokens.css`）の
   変数のみを使い、新しい色を直書きしない。
4. 上表の各関数に `snapshot("…")` を1行足す。
5. `src/js/40-events.js`
   - `CLICK_ROUTES` に `[data-undo]` のルートを追加。
   - `KEYDOWN_ROUTES` に `Cmd/Ctrl+Z` のルートを追加。
     キーの条件が既存ルートのどれとも重ならないため、配列末尾に足してよい
     （＝既存の評価順序を1つも動かさない）。
6. **`test/phase4-actions-equivalence.test.js` に置換ルールを追加。**
   `snapshot()` を足した 30-actions.js 内の関数すべてが対象。
   既存の `ETPL_NULL_GUARD` 等と同じ書式で、`UNDO_SNAPSHOT_DELETE_ITEM` のように
   1関数1定数で宣言し、対応するエントリの `subs` に足す。
   宣言の直前に「なぜこの変更を入れたか」を日本語コメントで残す（既存の書式に倣う）。
7. `test/undo.test.js` 新規作成。最低限:
   - `pushUndo` → `undoDepth()` が増える
   - 11回積むと深さが10で止まり、最も古いものが落ちている
   - `popUndo()` が積んだ時点の db を返し、以後の変更に影響されない（＝深いコピーである）
   - 空のときの `popUndo()` は null

### 完了の定義

- 全テスト pass。ミューテーションテスト1回実施済み（何を壊して何が落ちたかを報告に書く）。
- `node build.js` 後に `git status --short` が空。
- ユーザ確認用の手順:
  1. 項目を削除 → トーストの「取り消す」で戻る。
  2. 完了にする → `Cmd+Z` で戻る。
  3. 入力欄で文字を打って `Cmd+Z` → **項目は戻らず、文字だけが戻る**。
  4. 読み込み（別 JSON）→ 取り消しで元のデータに戻る。

---

## ステップC — #1 キーボード操作

### 決めてあること

- **カーソルは `ui.sel` とは別の `ui.cur`（項目 id か null）にする。**
  `ui.sel` は右パネルを開く選択なので、兼用すると「移動するたびにパネルが開く」ことになる。
  表示は `.row` に `cur` クラスを足し、`sel` とは違う見え方にする（左端の線など。
  色は既存トークンから選ぶ）。
- **キー割り当て（入力欄にフォーカスが無いときのみ）**

  | キー | 動作 |
  |---|---|
  | `j` | カーソルを次の行へ |
  | `k` | カーソルを前の行へ |
  | `Enter` | カーソル行を開く（`selectItem(ui.cur)`） |
  | `x` | カーソル行の完了を切り替え（`toggleItemDone(ui.cur)`） |
  | `e` | カーソル行の明確化を開く（`openClarify(ui.cur)`） |

  矢印キーは今回入れない（ページスクロールとの兼ね合いを別途詰める必要があるため）。
- 先頭で `k`、末尾で `j` は**何もしない**（巻き戻さない）。`ui.cur` が null のとき `j` は先頭へ。
- レビューのオーバーレイが開いているとき（`ui.review !== null`）は
  これらのキーは動かない。既存の `Escape` の挙動は変えない。
- プロジェクト／定型ビューではカーソルを使わない（対象が項目でないため）。
- **表示順とカーソルの順序を必ず同一の出所から取る。**
  現在 [12-view-list.js](src/js/12-view-list.js) の `renderList()` は
  絞り込み・並べ替え・「次のアクション」のコンテキスト別グループ化を関数の中で直接やっている。
  次のアクションビューでは**グループ化後の見た目の順序が items 配列の順序と一致しない**ため、
  そのままカーソルを作ると j/k の動きが画面とずれる。
  → `renderList()` から `listGroups(view)` を切り出す。戻り値は
  `[{label: string|null, items: Item[]}, ...]` で、**画面に出る順序そのもの**。
  `renderList()` はこれを描くだけにし、カーソルは `listGroups(...).flatMap(g => g.items.map(i => i.id))`
  を順序の出所にする。**これは純粋な切り出しで、描画結果を1文字も変えない。**
  切り出し前後で、同じデータに対する `#list` の innerHTML が一致することを確認すること。
- `moveCursor(ids, cur, delta)` を純関数として切り出す（`05-query.js` か 12-view-list.js のどちらか。
  描画に依存しないので `05-query.js` が素直）。**テストはこの関数に対して書く。**
- 描画のたびに、`ui.cur` が現在の表示リストに無ければ null に落とす（クランプ）。
  カーソル移動後は `document.querySelector(".row.cur")?.scrollIntoView({block:"nearest"})`。
- **発見できるようにする**: 左レール下部（`index.html` の `.rail-foot`）に
  `j/k 移動 · Enter 開く · x 完了 · ⌘Z 取り消し` の1行を小さく出す。

### やること

1. `src/js/00-constants.js` … `ui` に `cur:null` を追加。
2. `src/js/12-view-list.js` … `listGroups(view)` を切り出し、`renderList()` をその上に書き直す。
   `rowHTML` に `cur` クラスの出し分けを追加。
3. `src/js/05-query.js` … `moveCursor(ids, cur, delta)` と
   `orderedIds()`（`listGroups` を使う薄いもの）を追加。テスト用エクスポートも。
4. `src/js/30-actions.js` … 新規アクションとして
   `moveListCursor(delta)` / `openCursorItem()` / `toggleCursorDone()` / `clarifyCursorItem()` を追加。
   **既存関数の中身は変えない**（等価性テストの置換ルール追加は不要のはず。
   もし変える必要が出たら、変える前に止めて報告する）。
5. `src/js/40-events.js` … `KEYDOWN_ROUTES` に5本追加。
   - `Enter` のルートは、**既存の `[data-tplrun]` カードのルートより後ろ**に置く
     （カード上でのキー操作を奪わないため）。
   - 他は既存条件と重ならないので、`Escape` ルートの後・`n` ルートの前にまとめて置く。
   - すべて `!typing` を条件に含める。
6. `src/index.html` … `.rail-foot` にショートカットの1行を追加。必要なら
   `src/styles/10-layout.css` に控えめなスタイルを足す。
7. `test/cursor.test.js` 新規作成。
   - `moveCursor`: null から `+1` で先頭 / 末尾で `+1` は動かない / 先頭で `-1` は動かない /
     `cur` が配列に無い id のときは先頭 / 空配列のときは null。
   - `listGroups`: 「次のアクション」でコンテキスト名の昇順にグループが並び、
     flat にした id 順が画面順と一致すること（ダミー db を組んで検証）。

### 完了の定義

- 全テスト pass。
- 切り出し前後で `renderList()` の出力が一致することを確認した旨を報告する。
- ユーザ確認用の手順:
  1. 収集トレイで `j` `k` → 行のハイライトが動き、画面外に出たらスクロールが追う。
  2. `Enter` でパネルが開く。`Escape` で閉じる。カーソルは残っている。
  3. `x` で完了 → `Cmd+Z` で戻る。
  4. 次のアクションビューで `j` を連打 → **グループをまたいで上から順に**動く。
  5. 入力欄にフォーカスがある状態で `j` と打つ → 文字が入るだけでカーソルは動かない。

---

## 報告してほしいこと

各ステップの完了時に、以下を短く。

- 何を足したか（ファイルと関数名）
- テストの結果（件数と pass/fail）
- ミューテーションテストの内容と結果（ステップB）
- **決めごとから外れた判断をしたなら、その箇所と理由**
- ユーザに実ファイルで確認してほしいこと

うまくいかない・判断に迷う箇所が出たら、**推測で進めずに止めて報告する。**
