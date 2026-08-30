/* =========================================================
   取り消し（Undo）— db 丸ごとのスナップショット方式

   差分方式ではなく db 全体を JSON 文字列でコピーする。db は数百KB規模で、
   丸ごとコピーで十分速く、差分方式に比べて実装ミスの余地が桁違いに小さい。

   保持は最大10件のスタック。それを超えたら古い方から捨てる。

   DOM に触る関数（snapshot / undoLast / showToast）と
   触らない関数（pushUndo / popUndo / undoDepth / resetUndo）を必ず分ける。
   テストは後者だけを対象にする。
   ========================================================= */
const UNDO_MAX = 10;
let undoStack = [];

/* 現在の db を JSON 文字列にしてスタックへ積む。
   JSON.stringify した文字列で保持し、取り出すたびに JSON.parse し直すことで、
   push した後に db が変更されても積んだ内容に影響しない（深いコピー）。
   最大 UNDO_MAX 件を超えたら、最も古いものから捨てる。 */
function pushUndo(label){
  undoStack.push({label, json: JSON.stringify(db)});
  if(undoStack.length > UNDO_MAX) undoStack.shift();
}
/* 直近のスナップショットを取り出して db オブジェクトへ戻して返す。無ければ null。 */
function popUndo(){
  const top = undoStack.pop();
  if(!top) return null;
  return JSON.parse(top.json);
}
/* スタックの深さ。 */
function undoDepth(){
  return undoStack.length;
}
/* スタックを空にする（テスト用）。 */
function resetUndo(){
  undoStack = [];
}

/* pushUndo() + トースト表示。呼び出し側は「変更が確定する直前」
  （早期 return や ask() のキャンセルより後）でこれを呼ぶ。 */
function snapshot(label){
  pushUndo(label);
  showToast(label, {undo:true});
}
/* 直近のスナップショットへ db を差し替えて保存・再描画する。 */
function undoLast(){
  const restored = popUndo();
  if(!restored) return;
  db = restored;
  normalize(); save(); closePanel(); renderAll();
  showToast("取り消しました", {undo:false});
}

let toastTimer = null;
/* トーストの表示（8秒で自動的に消える）。
   opts.undo が true のときだけ「取り消す」ボタン（[data-undo]）を出す。
   取り消し不可の通知にも使えるよう、ボタンの有無をここで切り替えられるようにしておく
  （#5 の布石。今回は undo:true の場合しか使わない）。 */
function showToast(msg, opts){
  opts = opts || {};
  const t = $("#toast");
  if(!t) return;
  t.innerHTML = html`<span class="toast-msg">${msg}</span>${opts.undo ? raw('<button class="toast-undo" data-undo>取り消す</button>') : ""}`;
  t.classList.remove("hide");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hide"), 8000);
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  pushUndo, popUndo, undoDepth, resetUndo
});
