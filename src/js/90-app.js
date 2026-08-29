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
$("#capBtn").addEventListener("click", guard("収集", capture));
$("#capIn").addEventListener("keydown", guard("収集", e => { if(e.key==="Enter") capture(); }));

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
  window.__minamoBooted = true;
}catch(err){
  showError("起動", err && err.stack || String(err));
}
