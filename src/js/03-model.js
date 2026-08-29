/* =========================================================
   データ形状 — このアプリが読み書きする唯一のスキーマ定義。
   ここに書いてある以外のフィールドは（意図的な例外を除き）存在しない。
   短い変数名の慣習: it/i = item, p = project, t/tp = template,
   d = 上記いずれかの下書き(draft)オブジェクト。`prj(id)` は projects 版の
   `item(id)`（=`db.items.find`）で、`project` フィールド・`db.projects` 配列と
   同じ「プロジェクト」を指す別名。`tpl`/`template` も同様に、関数名・ローカル変数は
   短縮形 (`tpl…`, `tp`)、データ上のフィールド名・配列名は正式名 (`template`, `templates`)
   という命名慣習で統一されている（今回のリファクタでは意図的に維持し、リネームはしていない。
   dataset 属性 `data-tplrun` 等・DOM id `#tCycle` 等まで含めて改名すると影響範囲が
   HTML/CSS/イベント表にまで広がり「挙動を変えない」制約に対してリスクが見合わないため）。

   ---- item（行動・トレイ項目。db.items の要素） ----
   @typedef {Object} Item
   @property {string}  id        一意ID（uid()）
   @property {string}  title     行動の内容（表示・検索対象）
   @property {string}  note      メモ（自由記述）
   @property {"inbox"|"next"|"waiting"|"calendar"|"someday"|"reference"|"done"} state
   置き場所。意味は 00-constants.js の STATES を参照。
   @property {string}  context   コンテキスト名（db.contexts のいずれか、または未設定なら ""）
   @property {?string} project   所属プロジェクトの id（db.projects[].id）。所属なしは null
   @property {?string} due       期限日（"YYYY-MM-DD"）。calendar 状態で使う。なければ null
   @property {string}  who       待ち相手の名前（waiting 状態のときのみ意味を持つ）。なければ ""
   @property {?string} since     待ちを依頼した日（"YYYY-MM-DD"）。who が空なら意味を持たない
   @property {number}  minutes   所要時間の目安（分）。MIN_OPT のいずれかの値。0 は「未設定」
   @property {""|"high"|"low"} energy 必要なエネルギー。"" は未設定
   @property {string}  created   作成日（"YYYY-MM-DD"）
   @property {string}  updated   最終更新日（"YYYY-MM-DD"）。save() 時に空なら today() で補われる
   @property {?string} doneAt    完了日（"YYYY-MM-DD"）。state!=="done" なら null
   @property {string}  [tpl]     定型（template）から投入された場合のみ存在。元テンプレートの id。
   通常の newItem() では作られない任意フィールド（tplRun() が投入時に付与する。06-routines.js 参照）

   ---- project（プロジェクト。db.projects の要素） ----
   @typedef {Object} Project
   @property {string} id        一意ID
   @property {string} name      プロジェクト名
   @property {string} outcome   望む結果（完了の定義）。空文字可
   @property {"active"|"done"} status 状態
   @property {string} created   作成日（"YYYY-MM-DD"）

   ---- template（定型。db.templates の要素） ----
   @typedef {Object} Template
   @property {?string} id       一意ID。blankTpl() 直後（未保存の新規下書き）は null
   @property {string}  title    投入する行動の内容
   @property {string}  note     投入する行動のメモ
   @property {string}  context  投入する行動のコンテキスト
   @property {number}  minutes  投入する行動の所要時間
   @property {""|"high"|"low"} energy 投入する行動のエネルギー
   @property {?string} project  投入する行動の所属プロジェクト id
   @property {"next"|"calendar"} target 投入先の状態
   @property {"daily"|"weekly"|"monthly"|"adhoc"} cycle 周期
   @property {number[]} weekdays weekly のときだけ意味を持つ曜日番号の配列（0=日〜6=土）
   @property {number}  monthday monthly のときだけ意味を持つ日（1〜31、末日は丸め）
   @property {?string} lastRun  最後に投入した日（"YYYY-MM-DD"）。未投入は null
   @property {string}  [created] 作成日（"YYYY-MM-DD"）。saveTemplate() が新規作成時に付与する

   ---- db（アプリ全体の永続データ。localStorage キー KEY で保存される） ----
   @typedef {Object} Db
   @property {number}   version  データ形状のバージョン番号。normalize() のマイグレーションが読む
   @property {string}   appName  ツール名（表示用、ユーザが変更可）
   @property {string}   appTag   副題（空欄可）
   @property {Item[]}      items
   @property {Project[]}   projects
   @property {Template[]}  templates
   @property {string[]} contexts コンテキスト名の配列。順序が UI の並び順そのもの
   @property {{last: ?string, history: string[]}} review
   週次レビュー。last は最終実施日、history は実施日の新しい順配列（最大26件）
   @property {string}   [build] exportJSON() が書き出す直前に付与する BUILD 文字列（読み込み時は無視）
   ========================================================= */

/** @returns {Db} 初期状態の db */
function blank(){
  return {version:MODEL_VERSION, appName:"みなも", appTag:"MIND LIKE WATER", items:[], projects:[], templates:[],
    contexts:["@PC","@電話","@外出","@打合せ","@自宅"],
    review:{last:null, history:[]}};
}

/* ---- データ形状のマイグレーション ----
   db.version を見て、段階的に古い形状を現行形状へ引き上げる。
   MIGRATIONS[v] は「v-1 から v への1段分」の補完処理で、欠けているフィールドだけを埋める
   （既存の値は上書きしない＝旧データ互換）。version フィールドが無い旧データは 0 として扱う。
   新しいフィールドを追加するときは、ここに MIGRATIONS[MODEL_VERSION+1] を足して
   MODEL_VERSION をインクリメントする（既存の分岐はそのまま残す）。 */
const MODEL_VERSION = 1;
const MIGRATIONS = {
  /* 0 → 1: 元々の normalize() が場当たり的にやっていた欠損補完をそのまま移した段。 */
  1: d => {
    if(!d.contexts) d.contexts = blank().contexts;
    if(!d.projects) d.projects = [];
    if(!d.review) d.review = {last:null, history:[]};
    if(!d.templates) d.templates = [];
    if(!d.appName) d.appName = "みなも";
    if(d.appTag == null) d.appTag = "MIND LIKE WATER";
  }
};

/** db（グローバル）を現行バージョンまで段階的に補完する。既存データを壊さない。 */
function normalize(){
  let v = db.version || 0;
  while(v < MODEL_VERSION){
    v++;
    if(MIGRATIONS[v]) MIGRATIONS[v](db);
  }
  db.version = MODEL_VERSION;
}

const item = id => db.items.find(i => i.id===id);
const prj  = id => db.projects.find(p => p.id===id);

/** @returns {Item} 新規の収集トレイ項目 */
function newItem(title){
  return {id:uid(), title:title, note:"", state:"inbox", context:"", project:null, due:null,
    who:"", since:null, minutes:0, energy:"", created:today(), updated:today(), doneAt:null};
}


/** @returns {Template} 定型フォームの新規下書き（id はまだ無い） */
function blankTpl(){
  return {id:null, title:"", note:"", context:"", minutes:0, energy:"", project:null,
    target:"next", cycle:"daily", weekdays:[1], monthday:1, lastRun:null};
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  blank, normalize, newItem, blankTpl, item, prj, MODEL_VERSION, MIGRATIONS
});
