/* =========================================================
   アクション — 状態を変更する処理に名前を付けたもの
   （旧: document click / input / change ×2 / keydown ハンドラの
    各 if 分岐の中身を、そのまま名前付き関数へ移したもの。
    ロジックは変更していない。分岐内でイベント要素の dataset を
    直接読んでいた箇所は、呼び出し側（40-events.js）が読んで
    引数として渡す形に置き換えている＝束縛の変更のみ）

   ---- 描画呼び出しの方針（Phase 5） ----
   各アクションは、状態を変えたら原則 renderAll() で描き直す（部分描画の手選びをやめ、
   「選び忘れ＝画面が古いまま」というバグ源を無くす）。全再描画のコストは無視できる規模。
   renderPanel() はパネル未選択（!ui.sel）なら即 return するだけなので、パネルが
   閉じている状態で renderAll() を呼んでも無害。

   例外（部分描画のまま。理由付きでここに列挙する）:
   1. addContextNew（#ctxNew 連続追加）— renderPanel() が #pBody を丸ごと
      innerHTML で作り直すため、renderAll() にすると入力欄 #ctxNew 自体が
      毎回作り直され、Enter で連続追加している最中にフォーカスが失われる。
      現状どおり renderRail()+renderPanel() の後に明示的に #ctxNew を
      再フォーカスする形を維持する。
   2. addProjectAction（#pAdd プロジェクト内の行動追加）— 同上の理由
      （renderPanel() が #pAdd を含む #pBody を作り直す）。renderAll() にすると
      連続で行動を Enter 追加している最中にフォーカスが飛ぶ。
   3. changeTemplateCycle（#tCycle 定型の周期変更）— こちらは renderPanel() 経由
      ではなく直接 renderTplForm() を呼ぶ元のコードのままだが、同じ理由（周期を
      変えるたびに #pBody 全体を再構築するため、renderAll() にしても renderPanel()
      にしても #tCycle 自体は毎回作り直される）で全体再描画に寄せる意味がなく、
      むしろ renderList()/renderFilters() 分の無駄な再構築が増えるだけなので、
      元のとおり renderTplForm() だけを呼ぶ最小描画のままにする。
   4.（当初の3例外に加えて Phase 5 のブラウザ確認で見つけた4件目）
      setSearchQuery（絞り込みバーの検索入力 #qIn）— renderFilters() は #filters を
      丸ごと innerHTML で作り直し #qIn 自体を新しい要素に置き換えるため、
      renderAll()（renderFilters() を含む）にすると検索語を1文字打つたびに
      入力欄からフォーカスが外れ、連続入力ができなくなる。renderList() だけを
      呼ぶ元の実装を維持する。
   ========================================================= */

/* ---- 設定 ---- */
function openSettings(){
  ui.sel = "__settings__"; ui.clar = null; showPanel(); renderAll();
}
function moveContext(ix, d){
  const to = ix + d;
  if(to >= 0 && to < db.contexts.length){
    const a = db.contexts;
    const tmp = a[ix]; a[ix] = a[to]; a[to] = tmp;
    save(); renderAll();
  }
}
function deleteContext(ix){
  const name = db.contexts[ix], n = ctxUse(name);
  const msg = n ? `「${name}」を削除します。使用中の行動 ${n} 件は「コンテキスト未設定」になります。よろしいですか？`
                : `「${name}」を削除します。よろしいですか？`;
  if(!ask(msg)) return;
  db.items.forEach(i => { if(i.context===name) i.context = ""; });
  db.contexts.splice(ix,1);
  if(ui.view==="ctx:"+name) ui.view = "next";
  save(); renderAll();
}
function saveAppName(name, tag){
  if(!name){ tell("ツール名を入力してください。"); return; }
  db.appName = name; db.appTag = tag;
  save(); renderAll();
}

/* ---- 定型 ---- */
function openTemplateEditor(id){
  const tp = db.templates.find(x => x.id===id);
  if(tp){ ui.tplDraft = JSON.parse(JSON.stringify(tp)); ui.sel = "__tpl__"; ui.clar = null; showPanel(); renderAll(); }
}
function runTemplate(id){
  const tp = db.templates.find(x => x.id===id);
  if(!tp) return;
  if(tplRanToday(tp) && ui.flash!==tp.id){
    if(!ask("「" + tp.title + "」は本日すでに投入しています。もう一度追加しますか？")) return;
  }
  tplRun(tp); save(); flash(tp.id); renderAll();
}
function runAllPendingTemplates(){
  const pend = tplPending();
  if(!pend.length) return;
  pend.forEach(tplRun); save(); renderAll();
}
function newTemplate(){
  ui.tplDraft = blankTpl(); ui.sel = "__tpl__"; ui.clar = null; showPanel(); renderAll();
}
function toggleTemplateWeekday(ix){
  readTplForm();
  const a = ui.tplDraft.weekdays || (ui.tplDraft.weekdays = []);
  const at = a.indexOf(ix);
  if(at >= 0) a.splice(at,1); else a.push(ix);
  renderAll();
}
function saveTemplate({run}){
  const d = readTplForm();
  if(!d.title.trim()){ tell("行動を入力してください。"); return; }
  if(d.cycle==="weekly" && !(d.weekdays||[]).length){ tell("曜日を1つ以上選んでください。"); return; }
  let tp;
  if(d.id){
    tp = db.templates.find(x => x.id===d.id);
    Object.assign(tp, d);
  }else{
    d.id = uid(); d.created = today();
    db.templates.push(d); tp = d;
  }
  ui.tplDraft = null; closePanel();
  if(run){ tplRun(tp); flash(tp.id); }
  ui.view = "routines"; save(); renderAll();
}
function deleteTemplate(){
  if(!ask("この定型を削除します。投入済みの行動は残ります。よろしいですか？")) return;
  db.templates = db.templates.filter(x => x.id!==ui.tplDraft.id);
  ui.tplDraft = null; closePanel(); save(); renderAll();
}
function makeTemplateFromItem(id){
  const it = item(id);
  const d = blankTpl();
  d.title = it.title; d.note = it.note; d.context = it.context;
  d.minutes = it.minutes; d.energy = it.energy; d.project = it.project;
  ui.tplDraft = d; ui.sel = "__tpl__"; ui.clar = null; renderAll();
}

/* ---- 表示切り替え / 一覧 ---- */
function switchView(view){
  ui.view = view; ui.q = ""; closePanel(); renderAll();
}
function toggleItemDone(id){
  const it = item(id);
  if(it.state==="done"){ it.state = "next"; it.doneAt = null; }
  else { it.state = "done"; it.doneAt = today(); }
  it.updated = today(); save(); renderAll();
}
function selectItem(id){
  const it = item(id);
  ui.sel = it.id;
  ui.clar = it.state==="inbox" ? {step:"q1", path:[]} : null;
  showPanel(); renderAll();
}
function selectProject(id){
  ui.sel = id; ui.clar = null; showPanel(); renderAll();
}
function setMinutesFilter(n){
  ui.min = n; renderAll();
}
function setEnergyFilter(v){
  ui.energy = v; renderAll();
}

/* ---- 明確化フロー ---- */
function chooseClarifyOption(index){
  clarChoose(index);
}
function submitClarify(){
  clarSubmit();
}
function backClarify(){
  ui.clar.form = null; ui.clar.path.pop(); renderAll();
}
function restartClarify(){
  ui.clar = {step:"q1", path:[]}; renderAll();
}
function cancelClarify(){
  ui.clar = null; renderAll();
}
function startClarify(){
  openClarify(ui.sel);
}

/* ---- パネル ---- */
function closePanelView(){
  closePanel(); renderAll();
}

/* ---- 項目編集 ---- */
function saveItemEdit(){
  const it = item(ui.sel);
  it.title = $("#eTitle").value.trim() || it.title;
  it.note = $("#eNote").value;
  const ns = $("#eState").value;
  if(ns==="done" && it.state!=="done") it.doneAt = today();
  if(ns!=="done") it.doneAt = null;
  it.state = ns;
  it.context = $("#eCtx").value; it.minutes = +$("#eMin").value || 0;
  it.energy = $("#eEne").value; it.due = $("#eDue").value || null;
  it.who = $("#eWho").value.trim(); if(it.who && !it.since) it.since = today();
  it.project = $("#ePrj").value || null; it.updated = today();
  save(); closePanel(); renderAll();
}
function completeItem(){
  const it = item(ui.sel); it.state = "done"; it.doneAt = today(); it.updated = today(); save(); closePanel(); renderAll();
}
function reopenItem(){
  const it = item(ui.sel); it.state = "next"; it.doneAt = null; it.updated = today(); save(); closePanel(); renderAll();
}
function deleteItem(){
  if(!ask("この項目を削除します。元に戻せません。")) return;
  db.items = db.items.filter(x => x.id!==ui.sel); save(); closePanel(); renderAll();
}

/* ---- プロジェクト編集 ---- */
function saveProject(){
  const p = prj(ui.sel);
  p.name = $("#pName").value.trim() || p.name; p.outcome = $("#pOut").value;
  save(); closePanel(); renderAll();
}
function completeProject(){
  const p = prj(ui.sel); p.status = "done";
  db.items.filter(i => i.project===p.id && i.state!=="done").forEach(i => { i.state = "done"; i.doneAt = today(); });
  save(); closePanel(); renderAll();
}
function deleteProject(){
  if(!ask("プロジェクトを削除します。ぶら下がっている行動は残り、所属だけ外れます。")) return;
  db.items.filter(i => i.project===ui.sel).forEach(i => i.project = null);
  db.projects = db.projects.filter(p => p.id!==ui.sel);
  save(); closePanel(); renderAll();
}

/* ---- 上部バー ---- */
function promptImport(){
  $("#fileIn").click();
}

/* ---- レビュー ---- */
function reviewNext(){
  ui.review++;
  renderReview();
}
function reviewPrev(){
  ui.review--;
  renderReview();
}
function reviewClose(){
  ui.review = null;
  renderReview();
}
function reviewJump(){
  ui.view = REVIEW[ui.review].jump; ui.review = null; renderAll();
  renderReview();
}
function reviewFinish(){
  db.review.last = today();
  db.review.history.unshift(today());
  db.review.history = db.review.history.slice(0,26);
  ui.review = null; save(); renderAll();
  renderReview();
}
function openFromReview(id, isProject){
  ui.sel = id; ui.review = null; renderReview();
  const it = item(ui.sel);
  ui.clar = (it && it.state==="inbox") ? {step:"q1", path:[]} : null;
  ui.view = isProject ? "projects" : (it ? it.state : ui.view);
  showPanel(); renderAll();
}
function closeReviewOverlay(){
  ui.review = null; renderReview();
}

/* ---- 収集欄の検索・絞り込み（input） ---- */
function setSearchQuery(v){
  ui.q = v; renderList();
}

/* ---- 定型フォーム（change） ---- */
function changeTemplateCycle(){
  readTplForm(); renderTplForm();
}

/* ---- コンテキスト改名（change） ---- */
function renameContext(el, ix){
  const before = db.contexts[ix], after = el.value.trim();
  if(after===before) return;
  if(!after){ tell("空の名前にはできません。削除する場合は × を使ってください。"); el.value = before; return; }
  if(db.contexts.some((c,j) => j!==ix && c===after)){
    tell("同じ名前のコンテキストがすでにあります。"); el.value = before; return;
  }
  db.contexts[ix] = after;
  db.items.forEach(i => { if(i.context===before) i.context = after; });
  if(ui.view==="ctx:"+before) ui.view = "ctx:"+after;
  save(); renderAll();
}

/* ---- キー操作（keydown） ---- */
function addContextNew(el){
  const v = el.value.trim(); if(!v) return;
  if(db.contexts.includes(v)){ tell("同じ名前のコンテキストがすでにあります。"); return; }
  db.contexts.push(v); el.value = "";
  save(); renderRail(); renderPanel();
  const f = $("#ctxNew"); if(f) f.focus();
}
function addProjectAction(el){
  const v = el.value.trim(); if(!v) return;
  const a = newItem(v); a.state = "next"; a.project = ui.sel;
  db.items.push(a); save(); renderPanel(); renderRail();
  /* renderPanel() が #pAdd ごと作り直すためフォーカスが外れる。
     行動は続けて何件も足すことが多いので、収集欄(capture)や
     コンテキスト追加(addContextNew)と同じく入力欄へ戻す。
     作り直された後の要素を引き直す必要があるため el は使えない。 */
  const f = $("#pAdd"); if(f) f.focus();
}
function triggerTemplateCardClick(e, card){
  e.preventDefault(); card.dispatchEvent(new MouseEvent("click",{bubbles:true}));
}
function dismissActive(){
  if(ui.review!==null){ ui.review = null; renderReview(); }
  else if(ui.sel){ closePanel(); renderAll(); }
}
function focusCapture(e){
  e.preventDefault(); $("#capIn").focus();
}
function focusSearch(e){
  const q = $("#qIn"); if(q){ e.preventDefault(); q.focus(); }
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  openSettings, moveContext, deleteContext, saveAppName,
  openTemplateEditor, runTemplate, runAllPendingTemplates, newTemplate,
  toggleTemplateWeekday, saveTemplate, deleteTemplate, makeTemplateFromItem,
  switchView, toggleItemDone, selectItem, selectProject, setMinutesFilter, setEnergyFilter,
  chooseClarifyOption, submitClarify, backClarify, restartClarify, cancelClarify, startClarify,
  closePanelView,
  saveItemEdit, completeItem, reopenItem, deleteItem,
  saveProject, completeProject, deleteProject,
  promptImport,
  reviewNext, reviewPrev, reviewClose, reviewJump, reviewFinish, openFromReview, closeReviewOverlay,
  setSearchQuery, changeTemplateCycle, renameContext,
  addContextNew, addProjectAction, triggerTemplateCardClick, dismissActive, focusCapture, focusSearch
});
