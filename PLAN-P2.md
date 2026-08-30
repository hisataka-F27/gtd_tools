# 実行計画 — P2（#3 複数行ペースト / #11 レビュー履歴と書き出しの催促 / #8 完了項目のアーカイブ）

対象は [ROADMAP.md](ROADMAP.md) の P2。実装は Sonnet が行う前提で、
判断が要るところは先に決めてある。**決めてあることは勝手に変えない。
変える必要が出たら、変えずに止めて報告する。**

前提: main = `6df1e66` / `node --test 'test/*.test.js'` が 151 pass 0 fail。

ユーザに確認済みの方針:

1. **#8 は「畳む」と「書き出して削除」の両方を入れる。** 境界は **90日**。
2. **#5（完了・状態変更のフィードバック）は実装しない。** #2 の Undo トーストが
   `snapshot()` 対象の15操作で既に出るため、当初の狙いは達成済み。ROADMAP では対応済みに移す。

---

## 0. 全ステップ共通のルール

[PLAN-P0.md](PLAN-P0.md) の「0. 全ステップ共通のルール」8項目をそのまま適用する。要点の再掲:

1. `GTDタスク管理ツール.html` を直接編集しない。`src/` を編集して `node build.js`。
2. テストは `node --test 'test/*.test.js'`（グロブ必須）。
3. **ソース書き換えは Edit ツールを使う**（python heredoc 置換は、この作業中も含めて3回、
   無言で失敗している。使わないこと）。
4. ステップごとに専用ブランチ。マージ前に build → `git status --short` 空 → 全テスト pass。
5. **`test/phase4-actions-equivalence.test.js` を消さない・skip しない。**
   30-actions.js の既存関数を変えたら置換ルールを宣言し、ミューテーションテストを1回行う。
6. ブラウザプレビューは `data:` オリジンのサンドボックスで localStorage が例外を投げる。
   ここで得た結果は信用しない。
7. 各ステップ完了時に README.md と ROADMAP.md を更新する。
8. `REFACTOR_PLAN.md` / `PLAN-P0.md` / `PLAN-P1.md` は履歴として凍結。追記しない。

実装順は **A（#3）→ B（#11）→ C（#8）** で固定する。
B で切り出すダウンロードの共通処理を C が使うため、B が C より先である必要がある。

---

## ステップA — #3 複数行ペーストで1行1項目

### 決めてあること

- **`<input>` は貼り付け時に改行を空白へ潰す。** そのため
  「値に改行が入っていたら分割する」という実装は**動かない**。
  `#capIn` の **`paste` イベント**で `e.clipboardData.getData("text")` を読む方式にする。
  （この理由をコメントに必ず残すこと。将来同じ罠を踏まないため）
- **改行を含まない貼り付けは、これまでどおり素通しにする**（`preventDefault()` しない）。
  分割が起きるのは改行を含むときだけ。
- 改行を含むときの動作:
  1. `e.preventDefault()`
  2. `/\r?\n/` で分割 → 各行 `trim()` → 空行を捨てる
  3. 残った行が0件なら何もしない（入力欄も触らない）
  4. 1件でも複数件でも、それぞれ `newItem()` で収集トレイへ追加する
  5. `snapshot("まとめて収集")` を付ける。**まとめて収集は取り消しの対象にする**
     （一度に何件も増えるため、`capture()` 単体とは違って自力で戻すのが大変）。
     `snapshot()` は追加を確定する直前、上記3の判定より後に置く。
  6. 追加後は収集トレイへ移動して描き直し、`#capIn` にフォーカスを戻す
     （`capture()` と同じ後始末）。入力欄の中身は消す。
- **トーストで件数を出す**: `showToast("3件を収集トレイに追加しました", {undo:true})` 相当。
  `snapshot()` がトーストを出すので、ラベルを `"3件をまとめて収集"` のように
  件数入りにすれば足りる。**`showToast` を直接呼ぶ必要はない。**
- 上限は設けない。数千行を貼るような使い方は想定しない。

### やること

1. `src/js/90-app.js` … `captureLines(text)` を追加。
   **テストしやすいよう、「テキスト → 追加すべき行の配列」の部分だけを
   純関数 `splitCaptureLines(text)` として `02-util.js` に置く**
   （`90-app.js` は DOM とイベントの配線に徹する）。
2. `src/js/02-util.js` … `splitCaptureLines(text)` を追加。
   戻り値は trim 済み・空行を除いた文字列配列。テスト用エクスポートも。
3. `src/js/90-app.js` … `#capIn` に `paste` リスナーを追加（`guard("収集", ...)` で包む）。
4. `test/capture-paste.test.js` を新規作成。最低限:
   - 改行なし → 1要素
   - `"a\nb\nc"` → 3要素
   - 空行・前後の空白を含む（`"a\n\n  b  \n"`）→ `["a","b"]`
   - 空文字・空白だけ → 空配列
   - CRLF（`"a\r\nb"`）→ 2要素

### 完了の定義

- 全テスト pass。build 後に `git status --short` が空。
- ユーザ確認用の手順:
  1. 3行のテキストをコピーして収集欄に貼る → 3件が収集トレイに入り、件数入りトーストが出る。
  2. `Cmd+Z` で3件まとめて消える。
  3. 改行のない文字列を貼る → これまでどおり入力欄に入るだけ（勝手に追加されない）。

---

## ステップB — #11 レビュー履歴の表示と書き出しの催促

### 決めてあること

- **最後に書き出した日を db に持つ。** `db.lastExport`（`"YYYY-MM-DD"` か null）。
  `MODEL_VERSION` を 2 → 3 にし、`MIGRATIONS[3] = d => { if(d.lastExport === undefined) d.lastExport = null; }` を足す。
  **既存の `MIGRATIONS[1]` / `MIGRATIONS[2]` は消さない・変えない。**
  `blank()` にも `lastExport:null` を足し、Db の JSDoc に1行追加する。
- `exportJSON()` が**実際に書き出せたときだけ** `db.lastExport = today()` にして `save()` する。
  ダウンロードが塞がれてクリップボードやウィンドウに逃がした場合は**更新しない**
  （手元にファイルが残っていないため）。
- **ダウンロード処理を切り出す。** 現在 `exportJSON()` の中に直書きされている
  Blob → `<a download>` → クリックの一連を `downloadJSON(filename, text)` として
  `04-store.js` に切り出す。**ステップC でも使うので、この切り出しは必須。**
  例外時のフォールバック（`window.open` → クリップボード）は `exportJSON()` 側に残す。
- **レビューの完了画面（最終ページ）に2つ足す。**
  1. **実施履歴** … `db.review.history` の**直近8件**を `fmtDate` で横並びに出す。
     0件なら「まだ記録がありません」。
  2. **書き出しの状態** … `db.lastExport` が
     - null … 「一度も書き出していません」＋催促
     - 14日以上前 … 「最後の書き出しから N 日経っています」＋催促
     - 13日以内 … 「最後の書き出し M/D」だけを淡く出す（催促しない）

     催促の文言には「書き出し」ボタンを押すよう促す一文を入れるが、
     **レビュー画面に書き出しボタン自体は置かない**（上部バーに既にあるため、
     操作の入口を二重にしない）。
- **閾値の判定は純関数にする。** `exportReminder(lastExport, todayStr)` を
  `05-query.js` に置き、`{level:"never"|"stale"|"ok", days:number}` を返す。
  14 という数字はこの関数の中に1つだけ置く（`const EXPORT_REMIND_DAYS = 14`）。
- `reviewFinish()` は**変えない**（`db.review.history` への記録は既にできている）。

### やること

1. `src/js/03-model.js` … `MODEL_VERSION` を 3 に、`MIGRATIONS[3]`、`blank()` に `lastExport:null`、JSDoc 1行。
2. `src/js/04-store.js` … `downloadJSON(filename, text)` を切り出し、`exportJSON()` から使う。
   書き出し成功時に `db.lastExport = today(); save();`。
3. `src/js/05-query.js` … `EXPORT_REMIND_DAYS` と `exportReminder(lastExport, todayStr)`。テスト用エクスポートも。
4. `src/js/18-view-review.js` … 完了画面に履歴と書き出しの状態を追加。
5. `src/styles/60-review.css` … 必要最小限のスタイル（既存トークンのみ）。
6. `test/export-reminder.test.js` を新規作成。最低限:
   - `null` → `level:"never"`
   - 今日 / 13日前 → `level:"ok"`
   - 14日前 / 40日前 → `level:"stale"` と正しい `days`
   - マイグレーション: `version:2` の db を `normalize()` すると `lastExport:null` が入り、
     既存の値は書き換わらない

### 完了の定義

- 全テスト pass。build 後に `git status --short` が空。
- **旧データ互換の確認を報告に含める**（`version` を持たない db でも例外なく通ること）。
- ユーザ確認用の手順:
  1. 週次レビューを最後まで進める → 実施履歴と「一度も書き出していません」が出る。
  2. 上部バーの「書き出し」を実行 → もう一度レビューの最終画面を見ると
     催促が消え、書き出し日が出ている。

---

## ステップC — #8 完了項目のアーカイブ

### 決めてあること

- **境界は90日。`ARCHIVE_DAYS = 90` を1箇所だけに置く**（`05-query.js`）。
  判定は `oldDone()` … `state==="done" && doneAt && daysSince(doneAt) >= ARCHIVE_DAYS`。
  `doneAt` が無い完了項目は**古いとみなさない**（消える対象にしない。安全側に倒す）。
- **(1) 畳む** … 完了ビューでは、90日以上前の完了項目を既定で隠す。
  - `ui.doneAll`（真偽値、既定 false）を足す。
  - 隠れている件数が1件以上あるときだけ、リストの末尾に
    「さらに N 件（90日より前）を表示」のボタン `[data-doneall]` を出す。
    押すと `ui.doneAll = true` にして描き直す。逆向き（畳み直す）ボタンも同じ場所に出す。
  - **`ui.doneAll` は完了ビューから離れたら false に戻す**（`switchView` は
    既存関数なので触らない。`listGroups("done")` を呼ぶ側ではなく、
    `renderList()` の中で `ui.view!=="done"` なら false に戻す形にする）。
  - **`listGroups("done")` の戻り値は「画面に出る順序そのもの」でなければならない**
    （j/k カーソルの順序の出所でもあるため）。畳んでいるときは、
    隠している項目を**戻り値に含めない**こと。ここを間違えるとカーソルが
    画面に無い行へ飛ぶ。
- **(2) 書き出して削除** … 設定パネルに「古い完了項目の整理」セクションを足す。
  - 対象が0件なら「90日より前の完了項目はありません」とだけ出す（ボタンを出さない）。
  - 1件以上なら件数を出し、`#doneArchive`「書き出して削除」ボタンを出す。
  - 押したときの順序を**厳密にこのとおりにする**:
    1. `ask()` で確認（件数と、書き出しファイルが残ることを明示）
    2. `downloadJSON()`（ステップB で切り出したもの）で**先に**書き出す。
       書き出し用の中身は `{build, exportedAt, items:[...古い完了項目]}` の形。
       ファイル名は `minamo-gtd-archive-<today>.json`。
    3. 書き出しが**例外なく終わったときだけ** `snapshot("完了項目の整理")` を積んでから
       `db.items` から対象を除く → `save()` → `renderAll()`
    4. 書き出しで例外が出たら**削除しない**。`showError` で理由を出して終わる。
  - **「先に書き出す・失敗したら消さない」を必ず守ること。** ここが唯一の
    データが減る操作であり、順序を入れ替えると復旧できない事故になる。
  - 取り消しは `snapshot()` で1回分効く。ただし取り消しても書き出したファイルは残る
    （害はない）。この点を README に1行残す。

### やること

1. `src/js/05-query.js` … `ARCHIVE_DAYS`、`oldDone()`、`recentDone()`。テスト用エクスポートも。
2. `src/js/00-constants.js` … `ui` に `doneAll:false`。
3. `src/js/12-view-list.js` … `listGroups("done")` の出し分け、`renderList()` での
   `ui.doneAll` のリセットと「さらに N 件」ボタンの描画。
4. `src/js/16-view-edit.js` … 設定パネルに「古い完了項目の整理」セクション。
5. `src/js/30-actions.js` … 新規アクション `toggleDoneAll()` と `archiveOldDone()`。
   **既存関数は変えない。**
6. `src/js/40-events.js` … `CLICK_ROUTES` に `[data-doneall]` と `#doneArchive`。
7. `test/archive.test.js` を新規作成。最低限:
   - `oldDone`: 91日前の完了は対象 / 89日前は対象外 / `doneAt` が null の完了は対象外 /
     完了していない項目は対象外
   - `listGroups("done")` が `ui.doneAll=false` のとき古い分を**含まない**こと、
     `true` のとき全部含むこと、どちらも `doneAt` の降順であること

### 完了の定義

- 全テスト pass。build 後に `git status --short` が空。
- **「書き出しに失敗したら削除しない」ことを、どう確認したかを報告に書く**
  （`downloadJSON` を一時的に例外を投げるものに差し替えて確かめる等）。
- ユーザ確認用の手順:
  1. 完了ビューに90日より前の項目があるとき、既定で隠れており
     「さらに N 件」で出る。ビューを移動して戻ると畳み直っている。
  2. 完了ビューで `j`/`k` を押したとき、カーソルが**画面に見えている行だけ**を動く。
  3. 設定から「書き出して削除」→ JSON がダウンロードされ、完了ビューから消える。
  4. `Cmd+Z` で戻る。

---

## 報告してほしいこと

各ステップの完了時に、以下を短く。

- 何を足したか（ファイルと関数名）
- テストの結果（件数と pass/fail の実際の出力）
- 旧データ互換の確認結果（ステップB）／削除の安全性の確認結果（ステップC）
- **決めごとから外れた判断をしたなら、その箇所と理由**
- ユーザに実ファイルで確認してほしいこと

うまくいかない・判断に迷う箇所が出たら、**推測で進めずに止めて報告する。**
