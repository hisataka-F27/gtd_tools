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
function restoreBackup(){
  const bak = readBackup();
  if(!bak) return;
  if(!ask(fmtDate(bak.at) + " 時点の状態（" + bak.count + "件）に戻します。今の内容は上書きされます。よろしいですか？")) return;
  snapshot("バックアップからの復元");
  db = JSON.parse(bak.json);
  normalize(); save(); closePanel(); renderAll();
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
  snapshot("コンテキストの削除");
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
  snapshot("定型の一括投入");
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
  snapshot("定型の削除");
  db.templates = db.templates.filter(x => x.id!==ui.tplDraft.id);
  ui.tplDraft = null; closePanel(); save(); renderAll();
}
function makeTemplateFromItem(id){
  const it = item(id);
  /* ui.sel は項目IDのほかプロジェクトID・"__tpl__"・"__settings__" も取る。
     項目が見つからない状態でこれが呼ばれたら、例外を投げず何もしない
     （定型のカード実行 runTemplate と同じ構え）。 */
  if(!it) return;
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
  snapshot("完了の切り替え");
  if(it.state==="done"){ it.state = "next"; it.doneAt = null; }
  else { it.state = "done"; it.doneAt = today(); }
  it.updated = today(); save(); renderAll();
}
/* 「今日やる」印の付け外し。取り消し履歴には残さない（押せば見た目で分かり、
   もう一度押せば戻る操作なので、undo スタックを埋めるほうが害が大きい）。
   印を持てるのは state==="next" の項目だけだが、判定は isToday() 側が
   state を見て行うため、ここでは state を気にせず flagged だけを操作する
   （next 以外の項目に押しても isToday() が false のままなので表示には出ない）。 */
function toggleTodayFlag(id){
  const it = item(id);
  if(!it) return;
  it.flagged = (it.flagged===today()) ? null : today();
  save(); renderAll();
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
  /* 明確化フロー表示中しか #fBack は存在しないが、ui.clar が
     外れた状態で呼ばれても例外を投げないようにしておく。 */
  if(!ui.clar) return;
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
  /* #eSave は項目編集パネル表示中しか存在しないが、ui.sel が
     外れた状態で呼ばれても例外を投げないようにしておく。 */
  if(!it) return;
  snapshot("項目の変更");
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
  const it = item(ui.sel);
  /* #eDone も項目編集パネル表示中しか存在しないが、同様にガードしておく。 */
  if(!it) return;
  snapshot("完了にする");
  it.state = "done"; it.doneAt = today(); it.updated = today(); save(); closePanel(); renderAll();
}
function reopenItem(){
  const it = item(ui.sel);
  /* #eReopen も同様。 */
  if(!it) return;
  snapshot("未完に戻す");
  it.state = "next"; it.doneAt = null; it.updated = today(); save(); closePanel(); renderAll();
}
function deleteItem(){
  if(!ask("この項目を削除します。元に戻せません。")) return;
  snapshot("項目の削除");
  db.items = db.items.filter(x => x.id!==ui.sel); save(); closePanel(); renderAll();
}

/* ---- プロジェクト編集 ---- */
function saveProject(){
  const p = prj(ui.sel);
  /* #pSave はプロジェクト編集パネル表示中しか存在しないが、ui.sel が
     外れた状態で呼ばれても例外を投げないようにしておく。 */
  if(!p) return;
  snapshot("プロジェクトの変更");
  p.name = $("#pName").value.trim() || p.name; p.outcome = $("#pOut").value;
  save(); closePanel(); renderAll();
}
function completeProject(){
  const p = prj(ui.sel);
  /* #pDone も同様。 */
  if(!p) return;
  snapshot("プロジェクトの完了");
  p.status = "done";
  db.items.filter(i => i.project===p.id && i.state!=="done").forEach(i => { i.state = "done"; i.doneAt = today(); });
  save(); closePanel(); renderAll();
}
function deleteProject(){
  if(!ask("プロジェクトを削除します。ぶら下がっている行動は残り、所属だけ外れます。")) return;
  snapshot("プロジェクトの削除");
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
/* レビュー行内の操作（完了・いつかへ・次へ・今日）で使う取り消し履歴のラベル。
   行のボタン表示（REVIEW_ACT_LABEL、18-view-review.js）とは別に持つ
   （ボタンは短く「完了」、トーストは動作が分かる「完了にする」）。 */
const REVIEW_ACT_SNAPSHOT_LABEL = {
  done:"完了にする", someday:"いつかへ送る", next:"次のアクションへ", today:"今日やる印"
};
/* レビュー行内の操作（完了・いつかへ・次へ・今日）。状態遷移そのものは
   applyReviewAct（18-view-review.js の純関数）に切り出してある。ここでは
   その前後の取り消し履歴・保存・再描画だけを担う。オーバーレイは閉じず、
   renderReview() でその節を描き直す（対象から外れた行は自然に消える）。 */
function reviewAct(id, act){
  const it = item(id);
  if(!it) return;
  snapshot(REVIEW_ACT_SNAPSHOT_LABEL[act] || "レビューの操作");
  applyReviewAct(it, act);
  save(); renderReview(); renderRail();
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
  snapshot("コンテキスト名の変更");
  db.contexts[ix] = after;
  db.items.forEach(i => { if(i.context===before) i.context = after; });
  if(ui.view==="ctx:"+before) ui.view = "ctx:"+after;
  save(); renderAll();
}

/* ---- カーソル（j/k キー操作） ---- */
function moveListCursor(delta){
  /* プロジェクト／定型ビューではカーソルを使わない（対象が項目でないため）。 */
  if(ui.view==="projects" || ui.view==="routines") return;
  ui.cur = moveCursor(orderedIds(ui.view), ui.cur, delta);
  renderAll();
  $(".row.cur")?.scrollIntoView({block:"nearest"});
}
function openCursorItem(){
  if(ui.view==="projects" || ui.view==="routines" || !ui.cur) return;
  selectItem(ui.cur);
}
function toggleCursorDone(){
  if(ui.view==="projects" || ui.view==="routines" || !ui.cur) return;
  toggleItemDone(ui.cur);
}
function toggleCursorToday(){
  if(ui.view==="projects" || ui.view==="routines" || !ui.cur) return;
  toggleTodayFlag(ui.cur);
}
function clarifyCursorItem(){
  if(ui.view==="projects" || ui.view==="routines" || !ui.cur) return;
  openClarify(ui.cur);
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
  openSettings, restoreBackup, moveContext, deleteContext, saveAppName,
  openTemplateEditor, runTemplate, runAllPendingTemplates, newTemplate,
  toggleTemplateWeekday, saveTemplate, deleteTemplate, makeTemplateFromItem,
  switchView, toggleItemDone, toggleTodayFlag, selectItem, selectProject, setMinutesFilter, setEnergyFilter,
  chooseClarifyOption, submitClarify, backClarify, restartClarify, cancelClarify, startClarify,
  closePanelView,
  saveItemEdit, completeItem, reopenItem, deleteItem,
  saveProject, completeProject, deleteProject,
  moveListCursor, openCursorItem, toggleCursorDone, toggleCursorToday, clarifyCursorItem,
  promptImport,
  reviewNext, reviewPrev, reviewClose, reviewJump, reviewFinish, reviewAct, openFromReview, closeReviewOverlay,
  setSearchQuery, changeTemplateCycle, renameContext,
  addContextNew, addProjectAction, triggerTemplateCardClick, dismissActive, focusCapture, focusSearch
});
