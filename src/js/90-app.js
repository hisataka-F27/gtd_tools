/* =========================================================
   イベント
   ========================================================= */
function renderAll(){ renderRail(); renderFilters(); renderList(); renderPanel(); }

function capture(){
  const el = $("#capIn"), v = el.value.trim();
  if(!v) return;
  db.items.push(newItem(v));
  el.value = ""; save();
  if(ui.view!=="inbox"){ ui.view = "inbox"; }
  renderAll(); el.focus();
}
/* 複数行ペースト（#3）: 貼り付けたテキストを1行1項目として収集トレイへ追加する。
   分割自体は純関数 splitCaptureLines()（02-util.js）に任せ、ここは配線に徹する。
   snapshot() は「積んだ時点の db」を取り消し先として保存するため、
   必ず db.items へ追加する【前】に呼ぶ。追加した後に呼ぶと、追加済みの状態が
   取り消し先として保存され、取り消しても何も戻らなくなる。 */
function captureLines(text){
  const lines = splitCaptureLines(text);
  if(lines.length === 0) return false;
  snapshot(lines.length + "件をまとめて収集");
  lines.forEach(v => db.items.push(newItem(v)));
  save();
  if(ui.view!=="inbox"){ ui.view = "inbox"; }
  renderAll();
  return true;
}

$("#capBtn").addEventListener("click", guard("収集", capture));
$("#capIn").addEventListener("keydown", guard("収集", e => { if(isSubmitEnter(e)) capture(); }));
/* <input> は貼り付け時に改行を空白へ潰してしまうため、
   value を見てから「改行が入っていたら分割する」実装は成立しない。
   代わりに paste イベントで e.clipboardData から生のテキストを読み、
   改行を含むときだけ preventDefault() して自前で処理する。
   改行を含まない貼り付けは、これまでどおり素通しにする。 */
$("#capIn").addEventListener("paste", guard("収集", e => {
  const text = (e.clipboardData || window.clipboardData).getData("text");
  if(!/\r?\n/.test(text)) return;
  e.preventDefault();
  if(!captureLines(text)) return; /* 0件なら入力欄には一切触らない */
  const el = $("#capIn");
  el.value = "";
  el.focus();
}));

document.addEventListener("click", guard("クリック処理", e => {
  runRoutes(CLICK_ROUTES, e);
}));

document.addEventListener("input", guard("入力処理", e => {
  runRoutes(INPUT_ROUTES, e);
}));

/* 周期を変えたら、曜日・日にちの欄を出し分けるために描き直す */
document.addEventListener("change", guard("定型フォーム", e => {
  runRoutes(TPL_FORM_CHANGE_ROUTES, e);
}));

/* コンテキスト名の変更：使用中の行動をまとめて追従させる */
document.addEventListener("change", guard("コンテキスト編集", e => {
  runRoutes(CTX_CHANGE_ROUTES, e);
}));
document.addEventListener("keydown", guard("キー操作", e => {
  runRoutes(KEYDOWN_ROUTES, e);
}));
$("#fileIn").addEventListener("change", guard("読み込み", e => { if(e.target.files[0]) importJSON(e.target.files[0]); e.target.value = ""; }));

/* ---------- 起動 ---------- */
try{
  load();
  if(!ui.storeOK){
    $("#noStore").classList.remove("hide");
    $("#savedAt").textContent = "自動保存 不可";
  }else{
    $("#savedAt").textContent = "自動保存 有効";
  }
  renderAll();
  $("#capIn").focus();
  window.__appBooted = true;
}catch(err){
  showError("起動", err && err.stack || String(err));
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  captureLines
});
