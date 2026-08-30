/* =========================================================
   描画：一覧
   ========================================================= */
/* 検索対象：本文・メモ・待ち相手・コンテキスト・所属プロジェクト（名称と望む結果） */

/* listGroups(view): 画面に出る順序そのものを [{label, items}, ...] で返す純関数。
   renderList() の描画と j/k カーソルの移動順序の、両方の出所をこれ1つに揃える
   （「次のアクション」ビューはコンテキスト別グループ化で見た目の順序が
   items 配列そのままの順序と一致しないため、別々に組み立てると j/k が画面とずれる）。
   label が null のグループはグループ見出しを描かないビュー全体を表す。 */
function listGroups(view){
  const v = view;
  let items;
  if(v.startsWith("ctx:")){
    const c = v.slice(4);
    items = db.items.filter(i => i.state==="next" && i.context===c);
  }else if(v==="today"){
    items = todayItems();
  }else if(v==="done"){
    /* #8: 90日以上前に完了した項目（oldDone）は、ui.doneAll が false の間は
       戻り値そのものに含めない（含めると j/k のカーソルが画面に無い行へ飛ぶ）。 */
    items = db.items.filter(i => i.state==="done");
    if(!ui.doneAll) items = items.filter(i => !oldDone(i));
  }else{
    items = db.items.filter(i => i.state===v);
  }

  if(v==="next" || v.startsWith("ctx:")){
    if(ui.min) items = items.filter(i => i.minutes && i.minutes <= ui.min);
    if(ui.energy) items = items.filter(i => i.energy===ui.energy);
  }
  items = visible(items);

  if(v==="calendar") items.sort((a,b) => (a.due||"9") < (b.due||"9") ? -1 : 1);
  else if(v==="done") items.sort((a,b) => (b.doneAt||"") < (a.doneAt||"") ? -1 : 1);
  else if(v==="waiting") items.sort((a,b) => (a.since||"") < (b.since||"") ? -1 : 1);
  else items.sort((a,b) => a.created < b.created ? -1 : 1);

  if(v==="next"){
    const groups = {};
    items.forEach(i => { const k = i.context || "（コンテキスト未設定）"; (groups[k] = groups[k] || []).push(i); });
    return Object.keys(groups).sort().map(k => ({label: k, items: groups[k]}));
  }
  return [{label: null, items}];
}

function renderList(){
  const L = $("#list");
  const v = ui.view;

  /* #8: 完了ビューから離れたら畳んだ状態に戻す（ずっと展開したままにしない）。
     switchView() 側ではなく、描画のたびに通るここで確実に戻す。 */
  if(v!=="done") ui.doneAll = false;

  if(v==="projects"){ renderProjects(); return; }
  if(v==="routines"){ renderRoutines(); return; }

  let title = STATES[v] ? STATES[v].t : v, sub = STATES[v] ? STATES[v].sub : "";
  if(v.startsWith("ctx:")){
    const c = v.slice(4);
    title = c; sub = "このコンテキストで今できること";
  }else if(v==="today"){
    title = "今日やる"; sub = "その日のうちにやると決めたもの";
  }
  $("#vTitle").textContent = title;
  $("#vSub").textContent = ui.q ? `「${ui.q}」で絞り込み中` : sub;

  const groups = listGroups(v);
  const items = groups.flatMap(g => g.items);
  if(ui.cur && !items.some(i => i.id===ui.cur)) ui.cur = null;

  if(v==="done"){
    /* 「さらに N 件（90日より前）を表示」／畳み直すボタン。
       件数は listGroups() と同じ絞り込み（検索）を通した上で数える。
       対象が1件も無ければボタン自体を出さない。 */
    const oldCount = visible(db.items.filter(i => i.state==="done")).filter(oldDone).length;
    const btn = !oldCount ? "" :
      ui.doneAll
        ? html`<button class="btn" data-doneall>90日より前を畳む</button>`
        : html`<button class="btn" data-doneall>さらに ${oldCount} 件（90日より前）を表示</button>`;
    /* 「完了した項目はまだありません」は、畳んでいる分も含めて本当に0件のときだけ出す。
       全部が90日より前で畳まれているときにこれを出すと、すぐ下の
       「さらに N 件を表示」と矛盾した画面になる。 */
    const empty = (items.length || oldCount) ? "" : emptyHTML(v);
    L.innerHTML = empty + items.map(rowHTML).join("") + btn;
    return;
  }

  if(!items.length){ L.innerHTML = emptyHTML(v); return; }

  if(v==="next"){
    L.innerHTML = groups.map(g =>
      html`<div class="grp">${g.label} <span>${g.items.length}</span></div>` +
      g.items.map(rowHTML).join("")).join("");
  }else{
    L.innerHTML = items.map(rowHTML).join("");
  }
}
function rowHTML(i){
  const tags = [];
  if(i.context) tags.push(html`<span class="tag ctx">${i.context}</span>`);
  if(i.project && prj(i.project)) tags.push(html`<span class="tag prj">◆ ${prj(i.project).name}</span>`);
  if(i.who) tags.push(html`<span class="tag wait">${i.who} 待ち / ${daysSince(i.since||i.created)}日</span>`);
  if(i.due) tags.push(html`<span class="tag ${i.due < today() && i.state!=="done" ? "over" : "due"}">${fmtDate(i.due)}</span>`);
  if(i.minutes) tags.push(html`<span class="tag">${i.minutes}分</span>`);
  if(i.energy) tags.push(html`<span class="tag">${i.energy==="high"?"高":"低"}エネ</span>`);
  if(i.state==="next" && daysSince(i.updated) >= 14) tags.push(html`<span class="tag stale">${daysSince(i.updated)}日 停滞</span>`);
  if(i.state==="done" && i.doneAt) tags.push(html`<span class="tag">${fmtDate(i.doneAt)} 完了</span>`);
  /* 「今日やる」印の付け外しボタンは、押すことに意味があるビュー
     （次のアクション・コンテキスト別・今日やる）でのみ出す。 */
  const showFlag = ui.view==="next" || ui.view.startsWith("ctx:") || ui.view==="today";
  const flagBtn = showFlag
    ? html`<button class="flag ${isToday(i)?"on":""}" data-flag="${i.id}" aria-label="今日やる印">★</button>`
    : "";
  /* tags は既に html`` でエスケープ済みの断片配列。そのまま join した文字列を
     raw() で包み、外側テンプレートで二重エスケープしないようにする。 */
  return html`<div class="row ${i.state==="done"?"done":""} ${ui.sel===i.id?"sel":""} ${ui.cur===i.id?"cur":""}" data-id="${i.id}">
    <button class="tick" data-tick="${i.id}" aria-label="完了にする"></button>
    <div class="row-body"><span class="row-t">${i.title}</span>
      ${tags.length?raw(`<div class="meta">${tags.join("")}</div>`):""}</div>
    ${raw(flagBtn)}
  </div>`;
}
function emptyHTML(v){
  const M = {
    inbox:["◇","収集トレイは空です","浮かんだことは上の欄に書いて Enter。判断はあとでまとめてやります。"],
    next:["→","次のアクションがありません","収集トレイの項目を明確化すると、ここに具体的な一手が並びます。"],
    today:["★","今日やる印がありません","次のアクションの一覧で t を押すと、その日の予定に引き上げられます。"],
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

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  listGroups
});
