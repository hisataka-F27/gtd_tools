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
  const t = e.target;

  const open = t.closest("[data-open]");
  if(open){ ui.sel = "__settings__"; ui.clar = null; showPanel(); renderPanel(); return; }

  const cmove = t.closest("[data-cmove]");
  if(cmove){
    const ix = +cmove.dataset.cmove, d = +cmove.dataset.dir, to = ix + d;
    if(to >= 0 && to < db.contexts.length){
      const a = db.contexts;
      const tmp = a[ix]; a[ix] = a[to]; a[to] = tmp;
      save(); renderRail(); renderPanel();
    }
    return;
  }
  const cdel = t.closest("[data-cdel]");
  if(cdel){
    const ix = +cdel.dataset.cdel, name = db.contexts[ix], n = ctxUse(name);
    const msg = n ? `「${name}」を削除します。使用中の行動 ${n} 件は「コンテキスト未設定」になります。よろしいですか？`
                  : `「${name}」を削除します。よろしいですか？`;
    if(!ask(msg)) return;
    db.items.forEach(i => { if(i.context===name) i.context = ""; });
    db.contexts.splice(ix,1);
    if(ui.view==="ctx:"+name) ui.view = "next";
    save(); renderAll(); return;
  }
  if(t.id==="appSave"){
    const n = $("#appName").value.trim();
    if(!n){ tell("ツール名を入力してください。"); return; }
    db.appName = n; db.appTag = $("#appTag").value.trim();
    save(); renderRail(); return;
  }

  /* ---- 定型 ---- */
  const tedit = t.closest("[data-tpledit]");
  if(tedit){
    e.stopPropagation();
    const tp = db.templates.find(x => x.id===tedit.dataset.tpledit);
    if(tp){ ui.tplDraft = JSON.parse(JSON.stringify(tp)); ui.sel = "__tpl__"; ui.clar = null; showPanel(); renderPanel(); }
    return;
  }
  const trun = t.closest("[data-tplrun]");
  if(trun){
    const tp = db.templates.find(x => x.id===trun.dataset.tplrun);
    if(!tp) return;
    if(tplRanToday(tp) && ui.flash!==tp.id){
      if(!ask("「" + tp.title + "」は本日すでに投入しています。もう一度追加しますか？")) return;
    }
    tplRun(tp); save(); flash(tp.id); renderRail(); renderList();
    return;
  }
  if(t.id==="tplAllRun"){
    const pend = tplPending();
    if(!pend.length) return;
    pend.forEach(tplRun); save(); renderAll();
    return;
  }
  if(t.id==="tplNew"){
    ui.tplDraft = blankTpl(); ui.sel = "__tpl__"; ui.clar = null; showPanel(); renderPanel(); return;
  }
  const wd = t.closest("[data-wd]");
  if(wd){
    readTplForm();
    const ix = +wd.dataset.wd, a = ui.tplDraft.weekdays || (ui.tplDraft.weekdays = []);
    const at = a.indexOf(ix);
    if(at >= 0) a.splice(at,1); else a.push(ix);
    renderPanel(); return;
  }
  if(t.id==="tSave" || t.id==="tSaveRun"){
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
    if(t.id==="tSaveRun"){ tplRun(tp); flash(tp.id); }
    ui.view = "routines"; save(); renderAll();
    return;
  }
  if(t.id==="tDel"){
    if(!ask("この定型を削除します。投入済みの行動は残ります。よろしいですか？")) return;
    db.templates = db.templates.filter(x => x.id!==ui.tplDraft.id);
    ui.tplDraft = null; closePanel(); save(); renderAll(); return;
  }
  if(t.id==="eTpl"){
    const it = item(ui.sel);
    const d = blankTpl();
    d.title = it.title; d.note = it.note; d.context = it.context;
    d.minutes = it.minutes; d.energy = it.energy; d.project = it.project;
    ui.tplDraft = d; ui.sel = "__tpl__"; ui.clar = null; renderPanel(); return;
  }

  const nav = t.closest("[data-view]");
  if(nav){ ui.view = nav.dataset.view; ui.q = ""; closePanel(); renderAll(); return; }

  const tick = t.closest("[data-tick]");
  if(tick){
    e.stopPropagation();
    const it = item(tick.dataset.tick);
    if(it.state==="done"){ it.state = "next"; it.doneAt = null; }
    else { it.state = "done"; it.doneAt = today(); }
    it.updated = today(); save(); renderAll(); return;
  }

  const row = t.closest("[data-id]");
  if(row){
    const it = item(row.dataset.id);
    ui.sel = it.id;
    ui.clar = it.state==="inbox" ? {step:"q1", path:[]} : null;
    showPanel(); renderList(); renderPanel(); return;
  }

  const pc = t.closest("[data-prj]");
  if(pc){ ui.sel = pc.dataset.prj; ui.clar = null; showPanel(); renderPanel(); return; }

  const chipM = t.closest("[data-min]");
  if(chipM){ ui.min = +chipM.dataset.min; renderFilters(); renderList(); return; }
  const chipE = t.closest("[data-energy]");
  if(chipE){ ui.energy = chipE.dataset.energy; renderFilters(); renderList(); return; }

  const opt = t.closest("[data-opt]");
  if(opt){ clarChoose(+opt.dataset.opt); return; }

  if(t.id==="fSave"){ clarSubmit(); return; }
  if(t.id==="fBack"){ ui.clar.form = null; ui.clar.path.pop(); renderPanel(); return; }
  if(t.id==="clarRestart"){ ui.clar = {step:"q1", path:[]}; renderPanel(); return; }
  if(t.id==="clarEdit"){ ui.clar = null; renderPanel(); return; }
  if(t.id==="pClose"){ closePanel(); renderList(); return; }

  /* 項目編集 */
  if(t.id==="eSave"){
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
    save(); closePanel(); renderAll(); return;
  }
  if(t.id==="eDone"){ const it = item(ui.sel); it.state = "done"; it.doneAt = today(); it.updated = today(); save(); closePanel(); renderAll(); return; }
  if(t.id==="eReopen"){ const it = item(ui.sel); it.state = "next"; it.doneAt = null; it.updated = today(); save(); closePanel(); renderAll(); return; }
  if(t.id==="eClar"){ openClarify(ui.sel); return; }
  if(t.id==="eDel"){
    if(!ask("この項目を削除します。元に戻せません。")) return;
    db.items = db.items.filter(x => x.id!==ui.sel); save(); closePanel(); renderAll(); return;
  }

  /* プロジェクト編集 */
  if(t.id==="pSave"){
    const p = prj(ui.sel);
    p.name = $("#pName").value.trim() || p.name; p.outcome = $("#pOut").value;
    save(); closePanel(); renderAll(); return;
  }
  if(t.id==="pDone"){
    const p = prj(ui.sel); p.status = "done";
    db.items.filter(i => i.project===p.id && i.state!=="done").forEach(i => { i.state = "done"; i.doneAt = today(); });
    save(); closePanel(); renderAll(); return;
  }
  if(t.id==="pDel"){
    if(!ask("プロジェクトを削除します。ぶら下がっている行動は残り、所属だけ外れます。")) return;
    db.items.filter(i => i.project===ui.sel).forEach(i => i.project = null);
    db.projects = db.projects.filter(p => p.id!==ui.sel);
    save(); closePanel(); renderAll(); return;
  }

  /* 上部バー */
  if(t.id==="btnExport"){ exportJSON(); return; }
  if(t.id==="btnImport"){ $("#fileIn").click(); return; }
  if(t.id==="btnReview"){ openReview(); return; }

  /* レビュー */
  const rv = t.closest("[data-rv]");
  if(rv){
    const a = rv.dataset.rv;
    if(a==="next") ui.review++;
    else if(a==="prev") ui.review--;
    else if(a==="close"){ ui.review = null; }
    else if(a==="jump"){ ui.view = REVIEW[ui.review].jump; ui.review = null; renderAll(); }
    else if(a==="finish"){
      db.review.last = today();
      db.review.history.unshift(today());
      db.review.history = db.review.history.slice(0,26);
      ui.review = null; save(); renderAll();
    }
    renderReview(); return;
  }
  const rvo = t.closest("[data-rvopen]");
  if(rvo){
    ui.sel = rvo.dataset.rvopen; ui.review = null; renderReview();
    const it = item(ui.sel);
    ui.clar = (it && it.state==="inbox") ? {step:"q1", path:[]} : null;
    ui.view = rvo.dataset.rvp==="1" ? "projects" : (it ? it.state : ui.view);
    showPanel(); renderAll(); return;
  }
  if(t.dataset && t.dataset.ovbg){ ui.review = null; renderReview(); return; }
}));

document.addEventListener("input", guard("入力処理", e => {
  if(e.target.id==="qIn"){ ui.q = e.target.value; renderList(); }
}));

/* 周期を変えたら、曜日・日にちの欄を出し分けるために描き直す */
document.addEventListener("change", guard("定型フォーム", e => {
  if(e.target.id==="tCycle" && ui.tplDraft){ readTplForm(); renderTplForm(); }
}));

/* コンテキスト名の変更：使用中の行動をまとめて追従させる */
document.addEventListener("change", guard("コンテキスト編集", e => {
  const el = e.target;
  if(!el.classList || !el.classList.contains("ctx-in")) return;
  const ix = +el.dataset.cix, before = db.contexts[ix], after = el.value.trim();
  if(after===before) return;
  if(!after){ tell("空の名前にはできません。削除する場合は × を使ってください。"); el.value = before; return; }
  if(db.contexts.some((c,j) => j!==ix && c===after)){
    tell("同じ名前のコンテキストがすでにあります。"); el.value = before; return;
  }
  db.contexts[ix] = after;
  db.items.forEach(i => { if(i.context===before) i.context = after; });
  if(ui.view==="ctx:"+before) ui.view = "ctx:"+after;
  save(); renderAll();
}));
document.addEventListener("keydown", guard("キー操作", e => {
  if(e.target.id==="ctxNew" && e.key==="Enter"){
    const v = e.target.value.trim(); if(!v) return;
    if(db.contexts.includes(v)){ tell("同じ名前のコンテキストがすでにあります。"); return; }
    db.contexts.push(v); e.target.value = "";
    save(); renderRail(); renderPanel();
    const f = $("#ctxNew"); if(f) f.focus();
    return;
  }
  if(e.target.id==="pAdd" && e.key==="Enter"){
    const v = e.target.value.trim(); if(!v) return;
    const a = newItem(v); a.state = "next"; a.project = ui.sel;
    db.items.push(a); save(); renderPanel(); renderRail(); return;
  }
  const card = e.target.closest && e.target.closest("[data-tplrun]");
  if(card && (e.key==="Enter" || e.key===" ")){
    e.preventDefault(); card.dispatchEvent(new MouseEvent("click",{bubbles:true})); return;
  }
  if(e.key==="Escape"){
    if(ui.review!==null){ ui.review = null; renderReview(); }
    else if(ui.sel){ closePanel(); renderList(); }
    return;
  }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
  if(!typing && e.key==="n"){ e.preventDefault(); $("#capIn").focus(); }
  if(!typing && e.key==="/"){ const q = $("#qIn"); if(q){ e.preventDefault(); q.focus(); } }
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
