# GTD ワークスペース リファクタリング実行計画

対象: `GTDタスク管理ツール.html`（1430行 / 76KB / HTML+CSS+JS 全部入り）
実行者: Sonnet（本ドキュメントを上から順に実行する）
目的: **AI 生成物を「どの処理が何をしているか、ソースから追える」状態にする**

---

## 0. 前提と制約（変えてはいけないこと）

| 制約 | 内容 |
|---|---|
| 起動方法 | 最終成果物 `GTDタスク管理ツール.html` を**ダブルクリック（`file://`）で開いて動く**こと |
| 外部通信 | ゼロ。CDN・fetch・外部フォント一切なし |
| 依存 | npm パッケージを追加しない（Node 標準のみ。ビルドもテストも標準機能で完結） |
| データ | `localStorage` キー `minamo.gtd.v1` の**既存データが読めなくなってはいけない** |
| 挙動 | このリファクタでは**ユーザから見える挙動を1つも変えない**（バグも直さない。§8 に票を切る） |

> ⚠️ `file://` では `<script type="module">` が CORS で読めない。だから ES モジュール分割は使わず、
> **「読みやすい src/ を分割して置き、ビルドで1枚のHTMLに結合する」** 方式を採る（ユーザ決定済み）。

---

## 1. 現状の構造（マップ）

`GTDタスク管理ツール.html` の絶対行番号:

| 行 | 内容 |
|---|---|
| 1–6 | head / meta / title |
| **7–252** | `<style>` … CSS 245行。`/* ---------- 骨格 ---------- */` 形式の見出しで14ブロックに分かれている |
| 253–312 | `<body>` の静的シェル（rail / topbar / capture / filters / list / panel / overlay） |
| **313–1428** | `<script>` … JS 1115行 |
| 1429–1430 | 閉じタグ |

### JS 内訳（絶対行番号 → 責務）

| 行 | 責務 | 主な関数 |
|---|---|---|
| 320–345 | エラー表示・例外ガード | `showError` `guard` `ask` `tell` |
| 347–365 | 定数・グローバル状態 | `BUILD` `KEY` `STATES` `MIN_OPT` `CYCLES` `WD` / `db` `ui` |
| 366–427 | 永続化 | `uid` `today` `blank` `store` `load` `normalize` `save`(250ms デバウンス) |
| 428–444 | 小道具 | `$` `$$` `esc` `item` `prj` `daysSince` `fmtDate` `newItem` |
| 445–458 | 集計・抽出 | `counts` `projectNeedsAction` `staleNext` `oldWaiting` `overdue` |
| 459–609 | 定型（ルーティン） | `tplHits` `tplDue` `tplPending` `tplNextDate` `cycleLabel` `tplRun` `flash` `renderRoutines` `tplCard` `blankTpl` `readTplForm` `renderTplForm` |
| 610–642 | 左レール描画 | `renderRail` `navHTML` |
| 643–664 | 絞り込み | `renderFilters` `haystack` `visible` |
| 665–781 | 一覧・プロジェクト一覧 | `renderList` `rowHTML` `emptyHTML` `renderProjects` |
| 782–920 | 明確化フロー | `openClarify` `renderClarify` `formHTML` `clarChoose` `clarSubmit` |
| 921–1029 | 編集パネル各種 | `renderEdit` `renderPrjEdit` `ctxUse` `renderSettings` |
| 1030–1095 | パネル制御 | `renderPanel` `showPanel` `closePanel` |
| 1096–1134 | 週次レビュー | `openReview` `renderReview` |
| 1135–1150 | 入出力・全体描画・収集 | `exportJSON` `importJSON` `renderAll` `capture` |
| **1151–1350** | **click 委譲ハンドラ（約200行・約30分岐）** | 匿名関数1つ |
| 1351–1412 | input / change ×2 / keydown 委譲 | 匿名関数4つ |
| 1413–1428 | 起動 | `load()` → 初期描画 |

### 「追えない」原因（このリファクタが潰すもの）

1. **1151行目の click ハンドラにアプリの書き込み処理が全部入っている。** 約30個の `if` が並び、
   「この操作で何が起きるか」を知るには200行を上から読むしかない。呼び出し可能な名前が付いていない。
2. **描画呼び出しが分岐ごとに手選び。** `save(); renderRail(); renderPanel();` のように
   毎回どれを再描画するか人間が選んでいる。選び忘れ = 画面が古いまま、というバグ源。
3. **HTML を文字列連結で組み、`esc()` を手で挿している。** 埋め込み箇所ごとに
   エスケープを覚えている必要があり、抜けても壊れるまで気づかない。
4. **データ形状がソースのどこにも書かれていない。** item が持つフィールド
   （`title/note/state/context/minutes/energy/due/who/since/project/created/updated/doneAt`）は
   全文 grep でしか分からない。
5. **テストがゼロ。** 触っていいかの判断材料がない ← 最大のリスク。
6. `db` / `ui` がグローバル可変で、データ操作層がなく配列を直接いじっている。

---

## 2. 目標ディレクトリ構成

```
gtd_tools/
├── GTDタスク管理ツール.html   ← ビルド成果物（従来どおりダブルクリックで起動）
├── build.js                    ← Node標準のみ・依存ゼロの結合スクリプト
├── README.md                   ← 構成図・ビルド手順・データ形状
├── REFACTOR_PLAN.md            ← 本書
├── src/
│   ├── index.html              ← シェル。<!--INJECT:CSS--> / <!--INJECT:JS--> マーカー入り
│   ├── styles/
│   │   ├── 00-tokens.css       ← :root 変数
│   │   ├── 10-layout.css       ← 骨格 / ブランド / ビュー一覧 / 上部バー
│   │   ├── 20-capture.css      ← 収集ボックス / 絞り込み
│   │   ├── 30-list.css         ← 一覧 / 空状態 / プロジェクト
│   │   ├── 40-routines.css     ← 定型
│   │   ├── 50-panel.css        ← 右パネル / 明確化フロー
│   │   ├── 60-review.css       ← 週次レビュー
│   │   └── 90-responsive.css   ← 応答
│   ├── js/
│   │   ├── 00-constants.js     ← BUILD/KEY/STATES/MIN_OPT/CYCLES/WD/REVIEW
│   │   ├── 01-errors.js        ← showError/guard/ask/tell + window エラー捕捉
│   │   ├── 02-util.js          ← uid/today/esc/$/$$/daysSince/fmtDate
│   │   ├── 03-model.js         ← ★データ形状の唯一の定義。blank/normalize/newItem/blankTpl/item/prj
│   │   ├── 04-store.js         ← store/load/save/exportJSON/importJSON
│   │   ├── 05-query.js         ← counts/staleNext/oldWaiting/overdue/projectNeedsAction/haystack/visible/ctxUse
│   │   ├── 06-routines.js      ← tplHits/tplDue/tplPending/tplNextDate/cycleLabel/tplRun（ロジックのみ）
│   │   ├── 07-html.js          ← 自動エスケープする html`` テンプレート（Phase 6 で導入）
│   │   ├── 10-view-rail.js
│   │   ├── 11-view-filters.js
│   │   ├── 12-view-list.js
│   │   ├── 13-view-projects.js
│   │   ├── 14-view-routines.js ← renderRoutines/tplCard/renderTplForm/readTplForm
│   │   ├── 15-view-clarify.js
│   │   ├── 16-view-edit.js     ← renderEdit/renderPrjEdit/renderSettings
│   │   ├── 17-view-panel.js    ← renderPanel/showPanel/closePanel
│   │   ├── 18-view-review.js
│   │   ├── 30-actions.js       ← ★全ての状態変更を名前付き関数に（Phase 4 の中心）
│   │   ├── 40-events.js        ← ★セレクタ→アクションのルーティング表
│   │   └── 90-app.js           ← renderAll / 起動
│   └── (ファイル名の数字プレフィックスが、そのまま結合順序 = 依存順序)
└── test/
    ├── date.test.js
    ├── routines.test.js
    ├── query.test.js
    └── model.test.js
```

### build.js の仕様

- Node 標準 `fs` のみ。`node build.js` で完結。
- `src/styles/*.js` と `src/js/*.js` を**ファイル名昇順**で読み、`src/index.html` の
  `<!--INJECT:CSS-->` / `<!--INJECT:JS-->` を置換する。
- JS 全体を `(function(){ "use strict";` … `})();` で1つの IIFE に包む。
  → 各ファイルのトップレベル `const` は IIFE スコープに入る。**名前が全ファイルで一意である必要がある**ため、
  build.js に「重複宣言があれば結合前にエラーで落ちる」簡易チェックを入れること。
- 各ファイルの境界に `/* ==== src/js/12-view-list.js ==== */` を挿入する
  （成果物を読んだときにも出所が分かるように）。
- テスト用の `if (typeof module !== "undefined" && module.exports) module.exports = {...};` フッターは
  結合時に**取り除く**（ブラウザでは無害だが、成果物のノイズになるため）。
- 出力は `GTDタスク管理ツール.html` を上書き。

---

## 3. 実行フェーズ

各フェーズは **1コミット**。フェーズ末で必ずビルド＋§5 のスモークチェックを通してから次へ進む。
1フェーズでも赤なら、次に進まずそこで報告して止まること。

### Phase 0 — 安全網（コードを1行も変えない）

1. **未コミットの差分を先に処理する。** 現在 `<title>` が「みなも」→「Next Action」に書き換わった
   差分が未コミットで残っている。ユーザに意図を確認し、コミットするか戻すかを決めてから着手。
   作業ブランチを切る（`refactor/split-sources`）。
2. リファクタ前の状態にタグを打つ（`git tag pre-refactor`）。いつでも比較・巻き戻しできるようにする。
3. **黄金フィクスチャを作る。** ブラウザで開き、収集/次のアクション/待ち/カレンダー/いつか/資料/完了、
   プロジェクト2件、定型を daily・weekly・monthly・adhoc それぞれ1件ずつ、コンテキスト追加1件、
   日本語と `<>&"'` を含むタイトルを作ってから「書き出し」→ `test/fixtures/golden.json` に保存。
   以後この JSON を読み込んで挙動を比較する基準にする。
4. `docs/smoke-checklist.md` に §5 のチェックリストを置く。
5. **この時点の全描画関数の出力をスナップショットで押さえない**（DOM テスト不採用のため）。
   代わりに §5 の手動チェックを毎フェーズ実施する。

### Phase 1 — ビルド機構だけ導入（コードは機械的分割のみ）

- `src/index.html` / `src/styles/all.css`（まだ1枚のまま）/ `src/js/all.js`（まだ1枚のまま）に切り出す。
- `build.js` を書く。
- **検証: ビルド出力と `git show pre-refactor:` の元ファイルの差分が、
  挿入した境界コメントと IIFE ラッパ以外にゼロであること**を diff で確認する。ここが崩れたら先に進まない。

### Phase 2 — JS をファイル分割（純粋な移動のみ）

- §1 の表の境界に従って `src/js/*.js` へ切り出す。
- **禁止事項: この段階でリネーム・ロジック変更・整形の類は一切しない。**
  移動だけに限定することで、差分レビューが「行が移っただけ」と一目で分かる状態を保つ。
- 変数名の衝突が出たら、その場で直さずメモに残し Phase 5 でまとめて扱う。
- 検証: ビルド → §5 全項目。

### Phase 3 — 純粋ロジックのテスト（`node --test`）

副作用のない関数だけを対象にする。DOM もストレージも触らない。

| テストファイル | 対象 | 押さえるケース |
|---|---|---|
| `date.test.js` | `today` `daysSince` `fmtDate` `lastDateOf` | 月またぎ、うるう年、月末、曜日表記 |
| `routines.test.js` | `tplHits` `tplNextDate` `cycleLabel` | daily/weekly（複数曜日）/monthly（31日・月末丸め）/adhoc、`lastRun` 当日判定 |
| `query.test.js` | `haystack` `visible` `counts` `staleNext` `oldWaiting` `overdue` `projectNeedsAction` | 14日/7日の境界値ちょうど、期限当日は overdue でない、検索の大小文字・部分一致 |
| `model.test.js` | `blank` `normalize` `newItem` | 欠損フィールドの補完、`golden.json` を normalize しても壊れない、旧データ互換 |

- `test/fixtures/golden.json` を読んで `visible()` などに通す統合寄りのケースも1本入れる。
- `npm test` 相当は `node --test test/` で実行。package.json は作っても作らなくてよい（依存ゼロを維持）。
- テスト用に各純粋モジュール末尾へ `module.exports` ガードを付ける（build.js が除去する）。

### Phase 4 — click ハンドラの解体（本丸）

`30-actions.js` に、**現在 click ハンドラの中にある各分岐の中身を、名前付き関数として1対1で移す**。
名前は「何が起きるか」がそのまま読める日本語相当の英語にする。移す際、中身のロジックは変えない。

対応表（この30個を作る。左が現在の分岐条件、右が新しい関数名）:

| 現在の分岐 | アクション関数 |
|---|---|
| `[data-open]` | `openSettings()` |
| `[data-cmove]` | `moveContext(index, dir)` |
| `[data-cdel]` | `deleteContext(index)` |
| `#appSave` | `saveAppName(name, tag)` |
| `[data-tpledit]` | `openTemplateEditor(id)` |
| `[data-tplrun]` | `runTemplate(id)` |
| `#tplAllRun` | `runAllPendingTemplates()` |
| `#tplNew` | `newTemplate()` |
| `[data-wd]` | `toggleTemplateWeekday(index)` |
| `#tSave` / `#tSaveRun` | `saveTemplate({run})` |
| `#tDel` | `deleteTemplate()` |
| `#eTpl` | `makeTemplateFromItem(id)` |
| `[data-view]` | `switchView(view)` |
| `[data-tick]` | `toggleItemDone(id)` |
| `[data-id]` | `selectItem(id)` |
| `[data-prj]` | `selectProject(id)` |
| `[data-min]` / `[data-energy]` | `setMinutesFilter(n)` / `setEnergyFilter(v)` |
| `[data-opt]` | `chooseClarifyOption(index)` |
| `#fSave` `#fBack` `#clarRestart` `#clarEdit` | `submitClarify()` `backClarify()` `restartClarify()` `cancelClarify()` |
| `#pClose` | `closePanel()` |
| `#eSave` `#eDone` `#eReopen` `#eClar` `#eDel` | `saveItemEdit()` `completeItem()` `reopenItem()` `startClarify()` `deleteItem()` |
| `#pSave` `#pDone` `#pDel` | `saveProject()` `completeProject()` `deleteProject()` |
| `#btnExport` `#btnImport` `#btnReview` | `exportJSON()` `promptImport()` `openReview()` |
| `[data-rv]` | `reviewNext()` `reviewPrev()` `reviewClose()` `reviewJump()` `reviewFinish()` |
| `[data-rvopen]` | `openFromReview(id, isProject)` |

`40-events.js` は、これを**宣言的なルーティング表**にする:

```js
const CLICK_ROUTES = [
  ["[data-open]",    el => actions.openSettings()],
  ["[data-cmove]",   el => actions.moveContext(+el.dataset.cmove, +el.dataset.dir)],
  // …上から順に closest() で最初に一致したものを実行（現在の if の並び順を厳密に保つこと）
];
```

**注意点:**
- 現在の `if` の**評価順序に依存がある**（例: `[data-tick]` は `[data-id]` の行の中にあるので先に判定される）。
  ルーティング表の並びは現行の並び順を1行もずらさずに写すこと。
- `e.stopPropagation()` を呼んでいる分岐（`[data-tpledit]` `[data-tick]`）は、その挙動を表側で表現する
  （ルート定義に `{stop:true}` を持たせる等）。
- 同様に `input` / `change` ×2 / `keydown` のハンドラも同じ形式に揃える。
- 検証: ビルド → §5 全項目。**このフェーズが一番壊れやすいので、チェックリストは省略せず全部通す。**

### Phase 5 — 描画の一本化とデータ形状の明文化

1. **描画の統一。** 各アクションが `renderRail(); renderList();` を手選びしている状態をやめ、
   原則 `renderAll()` に寄せる。全再描画のコストは無視できる規模。
   - ただし**フォーカスを失うと操作が壊れる3箇所だけは例外**として現行の部分描画を維持する:
     コンテキスト追加（`#ctxNew` の連続入力）、プロジェクト内の行動追加（`#pAdd`）、
     定型フォームの周期変更（`#tCycle`）。例外である理由をコードコメントに書く。
2. **`03-model.js` の先頭にデータ形状を JSDoc で明記する。** item / project / template / db の
   全フィールドと意味と取りうる値。これが「ソースから追える」の中核。
3. `normalize()` を「バージョン付きマイグレーション」に整理する（現行の ad-hoc な穴埋めを、
   `version` を見て段階適用する形に）。既存 `minamo.gtd.v1` データが読めることをフィクスチャで確認。
4. Phase 2 でメモした命名の不統一をここでまとめて解消（例: `prj`/`project`、`tpl`/`template` の混在）。

### Phase 6 — 自動エスケープ HTML テンプレート

`07-html.js` に、埋め込み値を自動で `esc()` するタグ付きテンプレートを導入:

```js
const html = (strings, ...vals) => strings.reduce(
  (acc, s, i) => acc + s + (i < vals.length ? renderValue(vals[i]) : ""), "");
// renderValue: 配列は join、raw() 済みはそのまま、それ以外は esc()
const raw = s => ({__raw: String(s)});
```

- 既存のテンプレートリテラルを**1ファイルずつ**移行し、各ファイルの移行ごとにスモークを回す。
- 移行後、手書きの `esc()` 呼び出しがゼロになっていることを grep で確認する（`raw()` 経由を除く）。
- タイトルに `<script>alert(1)</script>` や `&"'` を入れた項目が正しく表示されることを確認。

### Phase 7 — CSS 分割・README・仕上げ

- CSS を §2 の8ファイルに分割（既存の `/* ---------- 見出し ---------- */` の区切りをそのまま使える）。
- `README.md`: 何のツールか / 起動方法 / `node build.js` / ディレクトリ構成図 /
  「機能を1つ追加するときにどのファイルを触るか」の導線 / データのバックアップ方法。
- `src/` を編集して `GTDタスク管理ツール.html` を直接編集しない旨を、
  成果物HTMLの先頭コメントにも書いておく（将来の自分と AI への注意書き）。

---

## 4. フェーズごとの「完了の定義」

各フェーズは、以下を全て満たしたときのみ完了とする。

1. `node build.js` がエラーなく通る
2. `node --test test/`（Phase 3 以降）が全て緑
3. §5 のスモークチェックが全項目 OK
4. ビルド成果物をブラウザで開き、**画面に赤いエラーバー（`#errBar`）が出ない**
   （このアプリは例外を握って画面に出す作りなので、これが最も早い異常検知になる）
5. コミット済み

---

## 5. スモークチェックリスト（毎フェーズ実行）

`golden.json` を読み込んだ状態から:

- [ ] 起動して赤いエラーバーが出ない / 右下「自動保存 有効」表示
- [ ] 収集: テキスト入力 → Enter → 収集トレイに入る
- [ ] 明確化: 収集トレイの項目をクリック → 質問フロー → 次のアクション/待ち/カレンダー/いつか/資料 の各分岐で保存できる
- [ ] 一覧: チェックで完了 → 再度クリックで復帰
- [ ] 編集パネル: 状態・コンテキスト・所要時間・期限・担当・プロジェクトを変えて保存 → 一覧に反映
- [ ] 削除: 項目 / プロジェクト / コンテキスト の各削除で確認ダイアログが出て、正しく消える
- [ ] コンテキスト: 追加・改名（使用中の項目が追従する）・並べ替え・削除
- [ ] プロジェクト: 一覧表示・行動追加(Enter)・完了・削除（行動は残り所属だけ外れる）
- [ ] 定型: 新規作成 / daily・weekly・monthly・adhoc の表示 / 単発投入 / 一括投入 / 編集 / 削除
- [ ] 絞り込み: 所要時間チップ・エネルギーチップ・検索(`/`)
- [ ] 週次レビュー: 開始 → 全ステップ送り → ジャンプ → 完了（最終レビュー日が更新される）
- [ ] キー操作: `n` で収集欄、`/` で検索欄、`Esc` でパネル/レビューを閉じる
- [ ] 書き出し → 別プロファイル/シークレットで読み込み → 同じ状態が再現する
- [ ] リロード後もデータが残っている（localStorage 保存が生きている）
- [ ] 記号入り（`<>&"'`）のタイトルが崩れず表示される
- [ ] ウィンドウ幅を狭めてレイアウトが崩れない

---

## 6. Sonnet への実行ルール

- **1フェーズ = 1コミット。** フェーズをまたいだ変更を混ぜない。
- **Phase 2 と Phase 4 では、機能追加・バグ修正・整形を絶対にしない。** 移動と抽出だけ。
  「ついでに直したくなるもの」は §8 に追記してユーザに報告する。
- 各フェーズ完了時に、変更ファイル一覧と §4 の1〜5の結果を報告する。
- 判断に迷う設計上の分岐（命名規則・ファイル分割の粒度など）が出たら、
  勝手に決めずユーザに聞く。**ただしそれまでのフェーズは完了させてから聞く。**
- 元ファイルは `git tag pre-refactor` でいつでも取り出せる。挙動が変わったか怪しいときは、
  そこからビルドして比較する。

---

## 7. リスクと対策

| リスク | 対策 |
|---|---|
| click ハンドラの分岐順序を崩し、別の操作が発火する | Phase 4 でルーティング表の並び順を1行もずらさず写す。§5 を全項目実施 |
| IIFE 結合で変数名が衝突し `SyntaxError` になる | build.js に重複宣言チェックを入れ、結合前に落とす |
| 既存の localStorage データが読めなくなる | Phase 0 で書き出し。Phase 5 の normalize 変更時にフィクスチャで検証 |
| Phase 6 のエスケープ移行で表示崩れ | 1ファイルずつ移行し、都度スモーク。記号入りタイトルで確認 |
| ビルド忘れで src と成果物がずれる | README に明記 + 成果物先頭に「直接編集しない」コメント |

---

## 8. 「今回は直さない」と決めたもの（別票）

リファクタ中に見つけたが、挙動を変えないため**手を付けない**。Phase 完了後にユーザへ提案する。

- `#eTpl` 分岐が `item(ui.sel)` の戻り値を null チェックせず参照している（選択が外れていると例外）
- `#fBack` 分岐が `ui.clar` の存在を前提にしている（同上）
- 現状は例外が `guard()` に捕まって赤いエラーバーに出るだけなので実害は小さいが、
  Phase 4 でアクションに切り出したあと、まとめてガードを入れるのが自然。
- （Phase 5 で発見）`addProjectAction`（`#pAdd`、プロジェクト内の行動追加）は、`#ctxNew` と違って
  追加後に入力欄を明示的に再フォーカスしていない。連続して行動を追加すると1件ごとにフォーカスが
  外れる。元からの挙動であり今回は変えていないが、`#ctxNew` と同様に追加後 `$("#pAdd").focus()`
  するのが自然な改善だと考えられる。

### Phase 2 での §2 構成からの逸脱（要報告）

- §2 の表は `REVIEW`（週次レビューの手順定義）を `00-constants.js` に置くとしているが、
  `REVIEW` の各エントリは `overdue` / `oldWaiting` / `staleNext` / `projectNeedsAction` を
  **オブジェクトリテラル評価時に値として参照**している（呼び出しではなく識別子参照）。
  これらは `const` で `05-query.js` に定義されており、ファイル結合順（00 → 01 → … → 05 → …）では
  `00-constants.js` の評価時点でまだ TDZ（未初期化）のため、そのまま配置すると
  `ReferenceError` で起動時に赤いエラーバーが出る。
  → 挙動を変えないことを優先し、`REVIEW` は実際の利用箇所である `18-view-review.js`
    （`05-query.js` より後に読み込まれる）に配置した。§2 の記述とは異なる配置である旨をここに記録する。
- 同様に、`db`/`ui`（グローバル可変状態の宣言）は §2 の表に明示がないため、
  元の「定数・グローバル状態」ブロックの並びに従って `00-constants.js` に置いた。
- `TREE`（明確化フローの質問木）も §2 に明示がないため、唯一の利用箇所である
  `15-view-clarify.js` に置いた。
- `flash()`（定型カードの一時ハイライト表示、`ui.flash` を操作し `renderList()` を呼ぶ）は
  §2 の `06-routines.js`（ロジックのみ）の対象関数一覧に含まれていない。DOM再描画を伴うため
  `14-view-routines.js`（ビュー層）に置いた。

### Phase 4 での §3 対応表からの逸脱・追記（要報告）

- `#pClose` は §3 の対応表で `closePanel()` としているが、`closePanel()` は既に
  `17-view-panel.js` で「引数なし・renderList() を呼ばない」関数として定義済み（Phase 2 以前から存在）。
  同名で再宣言すると build.js の重複トップレベル宣言チェックに引っかかるため、
  `closePanel(); renderList();` をまとめた新関数を `closePanelView()` という別名で
  `30-actions.js` に置いた。挙動（closePanel 呼び出し＋renderList 呼び出し）は元のまま。
- `#btnExport` → `exportJSON()`、`#btnReview` → `openReview()` は、対応表には載っているが
  どちらも Phase 2 以前から既存の名前付き関数（`04-store.js` / `18-view-review.js`）であり、
  元の分岐の中身は「その関数を呼ぶだけ」だった。よって `30-actions.js` に同名ラッパーは作らず、
  `40-events.js` のルートから既存関数を直接呼んでいる（重複宣言を避けるため、かつ
  「移すべき新しいロジックが無い」ため）。
- 対応表に載っていない分岐が1つあった: レビュー画面のオーバーレイ背景クリック
  （`if(t.dataset && t.dataset.ovbg){ ui.review = null; renderReview(); }`）。
  これは `[data-rv="close"]` とは別の要素（背景そのもの）のクリックで、元コードでも
  click ハンドラの最後の分岐として存在していた。`closeReviewOverlay()` として
  `30-actions.js` に追加し、ルーティング表の最後（元のコードでの位置と同じ）に置いた。
- `[data-rv]` 分岐は元コード1つの `if(rv){ if(a==="next")... else if...; renderReview(); return; }`
  だったが、実際に生成される `data-rv` の値は `next/prev/close/jump/finish` の5種類のみ
  （`src/js/18-view-review.js` で `data-rv="..."` を書き出している箇所を全数確認済み）。
  そのためルーティング表では `[data-rv="next"]` のように値ごとの5エントリに分解し、
  `reviewNext()` `reviewPrev()` `reviewClose()` `reviewJump()` `reviewFinish()` の
  各関数の末尾に元コード共通末尾の `renderReview()` 呼び出しを複製した。
  仮に将来 `data-rv` に上記5種以外の値を持つ要素が追加された場合、元コードは
  （何も分岐に一致せず）`renderReview()` だけ呼んで終わるが、新コードはどのルートにも
  一致せず後続のルート（`[data-rvopen]` 等）の判定に進む、という違いが理論上ありうる。
  現状のソースには該当する値は存在しないため実害はないが、判断の分かれ目としてここに記録する。
- click ハンドラの `[data-tpledit]` と `[data-tick]` は `e.stopPropagation()` を呼んでいたため、
  ルート定義に `stop:true` を持たせ、`runRoutes()` がマッチ時に `e.stopPropagation()` を呼ぶ形にした。
  ブラウザで実際に `[data-tick]` をクリックし、行選択（`[data-id]`）が誤発火しないことを確認済み
  （§ブラウザ検証の節を参照）。
- input / change×2 / keydown も同じ `runRoutes()` 形式に揃えた。keydown の `e.preventDefault()` は
  一部が条件付き（例: `"/"` は `$("#qIn")` が存在するときだけ呼ぶ）だったため、ルート側の宣言的な
  フラグでは表現しきれず、`focusCapture(e)` / `focusSearch(e)` / `triggerTemplateCardClick(e, card)`
  はイベント `e` 自体を引数として受け取り、元のコードと同じ条件分岐のまま `e.preventDefault()` を
  呼ぶ形にした。これは §3 の指示（`{stop:true}` 等の宣言的表現）の精神には沿っているが、
  click ハンドラの `stop:true` ほど完全に宣言的ではない妥協点として記録する。
- `test/phase4-actions-equivalence.test.js` を追加した。commit `6283bb5`（Phase 4 着手直前）の
  `src/js/90-app.js` を `git show` で取り出し、各分岐の中身を波括弧単位で抽出し、
  `src/js/30-actions.js` の対応する関数の中身と機械的に突き合わせている。
  分岐の中で `dataset` を直接読んでいた箇所を引数化した差分だけを明示的な置換ルールとして列挙し、
  それ以外の一字一句の不一致があれば FAIL するようにした。49件全て PASS。

### Phase 5 での §3 記述からの逸脱・追記（要報告）

- 描画一本化の例外は当初の3箇所（`#ctxNew` `#pAdd` `#tCycle`）に加え、ブラウザでの実操作確認により
  **4件目**を発見した: `setSearchQuery`（絞り込みバーの検索入力 `#qIn`、`input` イベント）。
  `renderFilters()` は `#filters` を丸ごと `innerHTML` で作り直し `#qIn` 自体を新しい要素に
  置き換えるため、`renderAll()`（`renderFilters()` を含む）にすると検索語を1文字打つたびに
  入力欄からフォーカスが外れ、連続入力ができなくなることをブラウザで実際に確認した。
  元の実装どおり `renderList()` のみを呼ぶ形を維持し、理由を `30-actions.js` 冒頭のコメントに明記した。
- `#pAdd`（プロジェクト内の行動追加）は、Phase 4 以前の原文（`90-app.js` 内の keydown ハンドラ）
  時点から**そもそも `#pAdd` の明示的な再フォーカスをしていない**ことをブラウザで確認した
  （`#ctxNew` は追加後に `$("#ctxNew").focus()` で明示的に再フォーカスしているが、`#pAdd` には
  対応するコードが元から無い）。そのため `#pAdd` で連続して行動を追加すると、1件追加するごとに
  入力欄からフォーカスが外れる。これは今回のリファクタで生まれた劣化ではなく元からの挙動であり、
  「挙動を変えない」方針に従いそのまま維持した。使い勝手の改善（自動再フォーカス）は
  §8「今回は直さないと決めたもの」に追記し、別途ユーザに提案する。
- Phase 5 項目4（`prj`/`project`、`tpl`/`template` の命名不統一の解消）について、Phase 2 の
  記録には具体的な「命名不統一のメモ」は残っていなかった（構造上の配置逸脱の記録のみ）。
  改めてコードベースを確認した結果、この短縮形（`prj`/`tpl`/`tp`/`d` 等）と正式名
  （`project`/`template`/`templates`）の使い分けは、DOM の dataset 属性名（`data-tplrun`
  `data-tpledit` 等）・DOM id（`#tCycle` `#tSave` 等）・CSS クラス名（`.tpl` `.tpl-grid` 等）にまで
  一貫して染み込んだ設計上の命名規約であり、これを統一的にリネームすると影響範囲が
  HTML生成コード・イベントルーティング表・CSSセレクタ全体に広がる。「挙動を変えない」
  制約下でのリスクとリターンを比較し、**リネームは実施せず**、`03-model.js` 冒頭の
  データ形状 JSDoc に命名規約そのものを文書化する形で対応した
  （「短い変数名の慣習」の段落を参照）。これは §3 の記述の「解消」を字義通りには行っておらず、
  「文書化による解消」という解釈で対応した旨をここに明記する。
