# 実行計画 — P1（#6 今日やる印 / #12 レビュー行内の処理）

対象は [ROADMAP.md](ROADMAP.md) の P1 2件。実装は Sonnet が行う前提で、
判断が要るところは先に決めてある。**決めてあることは勝手に変えない。
変える必要が出たら、変えずに止めて報告する。**

前提: main = `fc9483b` / `node --test 'test/*.test.js'` が 134 pass 0 fail。

ユーザに確認済みの方針（この3点が設計の土台）:

1. **今日やる印は翌日に自動で外れる。**
2. **印を付けられるのは「次のアクション」の項目だけ。**
3. **レビューの行内に出す操作は 完了 / いつかへ送る / 今日やる印。日付変更は入れない。**

---

## 0. 全ステップ共通のルール

[PLAN-P0.md](PLAN-P0.md) の「0. 全ステップ共通のルール」8項目をそのまま適用する。要点の再掲:

1. `GTDタスク管理ツール.html` を直接編集しない。`src/` を編集して `node build.js`。
2. テストは `node --test 'test/*.test.js'`（グロブ必須）。
3. **ソース書き換えは Edit ツールを使う**（python heredoc 置換は過去2回、無言で失敗している）。
4. ステップごとに専用ブランチ。マージ前に build → `git status --short` 空 → 全テスト pass。
5. **`test/phase4-actions-equivalence.test.js` を消さない・skip しない。**
   30-actions.js の既存関数を変えたら置換ルールを宣言し、ミューテーションテストを1回行う。
6. ブラウザプレビューは `data:` オリジンのサンドボックスで localStorage が例外を投げ、
   状態が呼び出し間で持ち越される。ここで得た結果は信用しない。
7. 各ステップ完了時に README.md と ROADMAP.md を更新する。
8. `REFACTOR_PLAN.md` / `PLAN-P0.md` は履歴として凍結。追記しない。

実装順は **A（#6）→ B（#12）** で固定する。B のレビュー行内操作に
「今日やる印を付ける」が含まれるため、A が先である必要がある。

---

## ステップA — #6 「今日やる」の印

### 決めてあること

- **`flagged` は真偽値ではなく「印を付けた日」（`"YYYY-MM-DD"` または `null`）で持つ。**
  判定は `i.flagged === today()`。
  こうすると「翌日に自動で外れる」を**掃除処理なしで**表現できる。
  日付が変われば判定が自然に false になるだけで、日付をまたいだ一括リセットも、
  起動時のフラグ掃除も要らない。真偽値 + リセット処理にすると、
  「アプリを開かずに日をまたいだ場合」の扱いが破綻する。
- **印を持てるのは `state==="next"` の項目だけ。**
  判定関数を `isToday(i)` として 05-query.js に置き、**`state` の条件もこの関数の中に含める**。
  完了すれば `state` が `done` になるので、判定は自動的に false になる。
  ＝完了時に印を消す処理は不要（書かないこと）。
- **データ形状の変更にはマイグレーションを1段足す。**
  [03-model.js](src/js/03-model.js) の `MODEL_VERSION` を 1 → 2 にし、
  `MIGRATIONS[2] = d => { d.items.forEach(i => { if(i.flagged === undefined) i.flagged = null; }); }` を足す。
  **既存の `MIGRATIONS[1]` は消さない・変えない。** `newItem()` にも `flagged:null` を足し、
  ファイル冒頭の Item の JSDoc に1行追加する（意味と permitted values を書く）。
- **ビューを1つ足す。** `ui.view === "today"`。
  - 左レールでの位置は「収集トレイ」の**直下**、「次のアクション」の上。
    （[10-view-rail.js](src/js/10-view-rail.js) の `rows.splice` と同じやり方で挿入する）
  - グリフは `★`、名前は「今日やる」。件数は印が付いている項目数。
  - `STATES` には**足さない**。`STATES` は item の `state` フィールドの取りうる値の定義であり、
    `today` は state ではないため。タイトル・説明・空状態の文言は個別に足す。
  - 空状態の文言（[12-view-list.js](src/js/12-view-list.js) の `emptyHTML`）に `today` を追加。
    文言案: `["★","今日やる印がありません","次のアクションの一覧で t を押すと、その日の予定に引き上げられます。"]`
  - 並びはコンテキスト別のグループ化を**しない**（対象が少数である前提のため）。
    `listGroups("today")` は `[{label:null, items:[...]}]` を返し、並び順は `created` 昇順
    （＝既定の並びと同じ）。
- **印の付け外しの手段は2つだけ。**
  1. **キーボード `t`** … カーソル行の印をトグルする。既存の `j/k/x/e` と同じ形で
     `KEYDOWN_ROUTES` に足す（`!typing && ui.review===null`）。
  2. **行の中のボタン** … `[data-flag]` を持つ小さなボタンを行に出す。
     **「次のアクション」「コンテキスト別」「今日やる」ビューでのみ出す**
     （他のビューでは押しても意味がないため）。印が付いていれば `on` クラスで見た目を変える。
- **項目編集パネル（`renderEdit` / `saveItemEdit`）には印の欄を足さない。**
  理由: 行のボタンとキー1つで足りること、`saveItemEdit` を変更すると等価性テストの
  置換ルールが必要になり、得られるものに対して手間とリスクが見合わないこと。
  **この判断は README にも1行残すこと。**
- **印の付け外しは `snapshot()` の対象にしない。** 押せば見た目で分かり、
  もう一度押せば戻る操作であり、取り消し履歴を埋めるほうが害が大きい
  （PLAN-P0.md ステップB の「作る・並べ替えるだけの操作は入れない」と同じ考え方）。
- `state` が `next` 以外に変わった項目の `flagged` は**そのまま残す**（消しに行かない）。
  `isToday()` が `state` を見るので表示には出ず、`next` に戻ってきた当日なら再び出る。
  この挙動を `isToday` のコメントに明記すること。

### やること

1. `src/js/03-model.js` … `MODEL_VERSION` を 2 に、`MIGRATIONS[2]` を追加、
   `newItem()` に `flagged:null`、Item の JSDoc に1行。
2. `src/js/05-query.js` … `isToday(i)`（純関数）と `todayItems()` を追加。テスト用エクスポートも。
3. `src/js/12-view-list.js` … `listGroups("today")` の分岐、`emptyHTML` に `today`、
   `rowHTML` に `[data-flag]` ボタン（上記3ビューでのみ出す）。
4. `src/js/10-view-rail.js` … 「今日やる」の行を挿入。
5. `src/js/30-actions.js` … 新規アクション `toggleTodayFlag(id)` と
   `toggleCursorToday()`（カーソル行用）。**既存関数は変えない。**
6. `src/js/40-events.js` … `CLICK_ROUTES` に `[data-flag]`（`[data-tick]` と同様に `stop: true`。
   行のクリック＝項目選択に伝播させないため）、`KEYDOWN_ROUTES` に `t`。
   `[data-flag]` は `[data-id]` より**前**に置くこと（`[data-tick]` と同じ理由）。
7. `src/index.html` の `.kbd-hint` に `t` を追記。`src/styles/30-list.css` にボタンのスタイル。
8. テスト `test/today-flag.test.js` を新規作成。最低限:
   - `isToday`: 今日の日付で `state==="next"` なら true / 昨日の日付なら false /
     `null` なら false / 日付は今日でも `state` が `next` 以外なら false
   - マイグレーション: `version:1` で `flagged` を持たない items を含む db を
     `normalize()` すると全項目に `flagged:null` が入り、**既存の値は書き換わらない**
   - `listGroups("today")` が印の付いた項目だけを `created` 昇順で返す

### 完了の定義

- 全テスト pass（134 + 新規）。build 後に `git status --short` が空。
- **旧データが壊れないことの確認を報告に含める**: `version` を持たない
  （＝リファクタ前の）db を読み込ませても例外が出ず、全項目に `flagged:null` が入ること。
- ユーザ確認用の手順:
  1. 次のアクションで `t` → 行に印が付き、左レールの「今日やる」の件数が増える。
  2. 「今日やる」ビューにその項目が出る。もう一度 `t` で消える。
  3. 印を付けた項目を完了にする → 「今日やる」から消える。
  4. devtools で `flagged` を昨日の日付に書き換えて再読み込み → 印が外れている。

---

## ステップB — #12 レビュー行内の処理

### 決めてあること

- **レビューは閉じない。** 行内のボタンを押したら、その場で状態を変えて
  `renderReview()` で描き直す。条件を満たさなくなった行はリストから消える
  （＝押すたびにその節の残りが減っていくのが正しい見え方）。
  既存の「開く」ボタン（`[data-rvopen]`）の挙動は**変えない**。
- **行内に出す操作は3種類。**

  | 種別 | 動作 |
  |---|---|
  | `done` | 完了にする（`state="done"`, `doneAt=today()`, `updated=today()`） |
  | `someday` | いつかへ送る（`state="someday"`, `updated=today()`） |
  | `next` | 次のアクションへ引き上げる（`state="next"`, `updated=today()`） |
  | `today` | **`state="next"` にしたうえで** `flagged=today()` |

  `today` が state も変える理由: `isToday()` は `state==="next"` を条件に含むため、
  いつかリストの項目に印だけ付けても「今日やる」に出てこない。
  **この一体の挙動をコメントに明記すること。**
- **どの節にどのボタンを出すかは、REVIEW の定義に宣言的に持たせる。**
  [18-view-review.js](src/js/18-view-review.js) の `REVIEW` 各エントリに `acts` を足す。
  ハードコードした if 分岐を描画側に書かないこと。確定した割り当て:

  | 節 | acts |
  |---|---|
  | 収集トレイを空にする | `["done"]`（本筋は「開く」→明確化。2分で終わるものだけその場で片づける） |
  | 期限切れを拾う | `["done","someday"]` |
  | 待ちを督促する | `["done","next"]`（自分で引き取る＝次のアクションへ） |
  | 止まっているプロジェクトを動かす | **なし**（行がプロジェクトなので項目の操作は出さない） |
  | 停滞したアクションを見直す | `["done","someday","today"]` |
  | いつかリストを棚卸しする | `["done","next","today"]` |

  `acts` が無い節・プロジェクト行（`getP` を持つ節）では、従来どおり「開く」だけを出す。
- **状態遷移そのものは純関数に切り出す。**
  `applyReviewAct(it, act)` を 18-view-review.js に置き、
  引数の item を書き換えるだけ（save も描画もしない）にする。テストはこれに対して書く。
  アクション `reviewAct(id, act)` は `applyReviewAct` + `snapshot()` + `save()` + `renderReview()` + `renderRail()`。
- **`reviewAct` は `snapshot()` の対象にする**（完了・状態変更は取り消せるべき、という
  PLAN-P0.md ステップB の方針と一貫させる）。ラベルは操作に応じて
  「完了にする」「いつかへ送る」「次のアクションへ」「今日やる印」。
- ボタンのラベルは `完了` / `いつかへ` / `次へ` / `今日` の4つ。既存の `.btn.sm` を使う。
  行が横に伸びるので、`.rv-item` のボタン群は折り返さず右寄せに収まるようにする
  （必要なら `60-review.css` に最小限のスタイルを足す。既存トークンのみ使用）。

### やること

1. `src/js/18-view-review.js` … `REVIEW` に `acts` を追加、`applyReviewAct(it, act)` を追加、
   行の描画にボタン群を追加（`[data-rvact]` と `[data-rvid]`)。テスト用エクスポートを足す。
2. `src/js/30-actions.js` … 新規アクション `reviewAct(id, act)`。**既存関数は変えない。**
3. `src/js/40-events.js` … `CLICK_ROUTES` に `[data-rvact]` を追加。
   **`[data-rvopen]` より前**に置くこと（ボタンが行の中にあるため、
   先に評価されないと「開く」に吸われる可能性がある。実際の DOM 構造を見て確認すること）。
4. `src/styles/60-review.css` … 必要最小限のスタイル。
5. テスト `test/review-act.test.js` を新規作成。最低限:
   - `applyReviewAct` の4種それぞれで、`state` / `doneAt` / `flagged` / `updated` が
     期待どおりに変わること
   - `today` は `state` も `next` にすること
   - `REVIEW` の各節の `acts` が上の表と一致していること（節の順序と併せて固定する）

### 完了の定義

- 全テスト pass。build 後に `git status --short` が空。
- ユーザ確認用の手順:
  1. 週次レビューを開き、「停滞したアクションを見直す」で `完了` → **オーバーレイは開いたまま**
     その行が消え、残り件数が減る。
  2. `いつかへ` を押した項目が、レビューを閉じたあと「いつか / たぶん」に居る。
  3. `今日` を押した項目が「今日やる」に出る。
  4. レビュー中に押した操作が `Cmd+Z` で取り消せる（トーストがオーバーレイの上に出る）。
  5. 「止まっているプロジェクトを動かす」の節には、従来どおり「開く」しか出ない。

---

## 報告してほしいこと

各ステップの完了時に、以下を短く。

- 何を足したか（ファイルと関数名）
- テストの結果（件数と pass/fail の実際の出力）
- 旧データ互換の確認結果（ステップA）
- **決めごとから外れた判断をしたなら、その箇所と理由**
- ユーザに実ファイルで確認してほしいこと

うまくいかない・判断に迷う箇所が出たら、**推測で進めずに止めて報告する。**
