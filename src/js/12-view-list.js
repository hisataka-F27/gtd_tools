/* =========================================================
   描画：一覧
   ========================================================= */
/* 検索対象：本文・メモ・待ち相手・コンテキスト・所属プロジェクト（名称と望む結果） */

function renderList(){
  const L = $("#list");
  const v = ui.view;

  if(v==="projects"){ renderProjects(); return; }
  if(v==="routines"){ renderRoutines(); return; }

  let title = STATES[v] ? STATES[v].t : v, sub = STATES[v] ? STATES[v].sub : "";
  let items;
  if(v.startsWith("ctx:")){
    const c = v.slice(4);
    title = c; sub = "このコンテキストで今できること";
    items = db.items.filter(i => i.state==="next" && i.context===c);
  }else{
    items = db.items.filter(i => i.state===v);
  }
  $("#vTitle").textContent = title;
  $("#vSub").textContent = ui.q ? `「${ui.q}」で絞り込み中` : sub;

  if(v==="next" || v.startsWith("ctx:")){
    if(ui.min) items = items.filter(i => i.minutes && i.minutes <= ui.min);
    if(ui.energy) items = items.filter(i => i.energy===ui.energy);
  }
  items = visible(items);

  if(v==="calendar") items.sort((a,b) => (a.due||"9") < (b.due||"9") ? -1 : 1);
  else if(v==="done") items.sort((a,b) => (b.doneAt||"") < (a.doneAt||"") ? -1 : 1);
  else if(v==="waiting") items.sort((a,b) => (a.since||"") < (b.since||"") ? -1 : 1);
  else items.sort((a,b) => a.created < b.created ? -1 : 1);

  if(!items.length){ L.innerHTML = emptyHTML(v); return; }

  if(v==="next"){
    const groups = {};
    items.forEach(i => { const k = i.context || "（コンテキスト未設定）"; (groups[k] = groups[k] || []).push(i); });
    L.innerHTML = Object.keys(groups).sort().map(k =>
      `<div class="grp">${esc(k)} <span>${groups[k].length}</span></div>` +
      groups[k].map(rowHTML).join("")).join("");
  }else{
    L.innerHTML = items.map(rowHTML).join("");
  }
}
function rowHTML(i){
  const tags = [];
  if(i.context) tags.push(`<span class="tag ctx">${esc(i.context)}</span>`);
  if(i.project && prj(i.project)) tags.push(`<span class="tag prj">◆ ${esc(prj(i.project).name)}</span>`);
  if(i.who) tags.push(`<span class="tag wait">${esc(i.who)} 待ち / ${daysSince(i.since||i.created)}日</span>`);
  if(i.due) tags.push(`<span class="tag ${i.due < today() && i.state!=="done" ? "over" : "due"}">${fmtDate(i.due)}</span>`);
  if(i.minutes) tags.push(`<span class="tag">${i.minutes}分</span>`);
  if(i.energy) tags.push(`<span class="tag">${i.energy==="high"?"高":"低"}エネ</span>`);
  if(i.state==="next" && daysSince(i.updated) >= 14) tags.push(`<span class="tag stale">${daysSince(i.updated)}日 停滞</span>`);
  if(i.state==="done" && i.doneAt) tags.push(`<span class="tag">${fmtDate(i.doneAt)} 完了</span>`);
  return `<div class="row ${i.state==="done"?"done":""} ${ui.sel===i.id?"sel":""}" data-id="${i.id}">
    <button class="tick" data-tick="${i.id}" aria-label="完了にする"></button>
    <div class="row-body"><span class="row-t">${esc(i.title)}</span>
      ${tags.length?`<div class="meta">${tags.join("")}</div>`:""}</div>
  </div>`;
}
function emptyHTML(v){
  const M = {
    inbox:["水面","収集トレイは空です","浮かんだことは上の欄に書いて Enter。判断はあとでまとめてやります。"],
    next:["→","次のアクションがありません","収集トレイの項目を明確化すると、ここに具体的な一手が並びます。"],
    waiting:["…","誰にも預けていません","自分でやらない仕事は、明確化のときに「待ち」へ送ります。"],
    calendar:["▣","日付指定のものはありません","その日でなければ意味がないものだけを、ここに置きます。"],
    someday:["○","いつかリストは空です","今はやらないが捨てたくないものを退避させておく場所です。"],
    reference:["▤","資料はありません","行動不要で、あとで見返すものを保管します。"],
    done:["✓","完了した項目はまだありません","片づいたものはここに積み上がります。"],
    projects:["◆","プロジェクトがありません","2つ以上の行動が必要なものは、明確化のときにプロジェクトにします。"],
    routines:["◈","定型がありません","繰り返し発生する作業を登録しておくと、クリック1回で投入できます。"]
  };
  const m = M[v] || M.inbox;
  return `<div class="empty"><span class="mk">${m[0]}</span><h3>${m[1]}</h3><p>${m[2]}</p></div>`;
}
