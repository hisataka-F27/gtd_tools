function flash(id){
  ui.flash = id;
  setTimeout(() => { if(ui.flash===id){ ui.flash = null; if(ui.view==="routines") renderList(); } }, 1600);
}

function renderRoutines(){
  $("#vTitle").textContent = "定型";
  $("#vSub").textContent = "繰り返す作業を登録して、クリックで投入する";
  const pend = tplPending();
  let html = `<div class="tpl-top">
    ${pend.length
      ? `<button class="btn primary" id="tplAllRun">今日の分 ${pend.length} 件をまとめて投入</button>`
      : `<span class="tpl-none">${db.templates.length ? "今日投入すべき定型はありません" : ""}</span>`}
    <span class="sp"></span>
    <button class="btn" id="tplNew">＋ 定型を追加</button>
  </div>`;

  if(!db.templates.length){
    $("#list").innerHTML = html + `<div class="empty"><span class="mk">◈</span>
      <h3>定型がありません</h3>
      <p>日報、週次の勤怠入力、月初の棚卸しなど、毎回同じ内容で発生する作業を登録しておくと、
      クリック1回で次のアクションに入ります。<br>
      既存の行動を開いて「この項目を定型にする」からも登録できます。</p></div>`;
    return;
  }
  ["daily","weekly","monthly","adhoc"].forEach(cy => {
    const list = db.templates.filter(t => t.cycle===cy);
    if(!list.length) return;
    html += `<div class="grp">${CYCLES[cy]} <span>${list.length}</span></div>
      <div class="tpl-grid">${list.map(tplCard).join("")}</div>`;
  });
  $("#list").innerHTML = html;
}
function tplCard(t){
  const due = tplDue(t), ran = tplRanToday(t), hot = ui.flash===t.id;
  const bits = [`<span class="tag">${esc(cycleLabel(t))}</span>`];
  if(t.context) bits.push(`<span class="tag ctx">${esc(t.context)}</span>`);
  if(t.minutes) bits.push(`<span class="tag">${t.minutes}分</span>`);
  if(t.project && prj(t.project)) bits.push(`<span class="tag prj">◆ ${esc(prj(t.project).name)}</span>`);
  if(t.target==="calendar") bits.push(`<span class="tag due">カレンダーへ</span>`);
  const cta = hot ? "投入しました"
    : ran ? "本日投入済み"
    : due ? "▸ 今日の分を投入" : "▸ クリックで投入";
  return `<div class="tpl ${due?"due":""} ${ran&&!hot?"ran":""} ${hot?"flash":""}"
      data-tplrun="${t.id}" role="button" tabindex="0" aria-label="${esc(t.title)} を投入">
    <button class="tpl-edit" data-tpledit="${t.id}">編集</button>
    <h4>${esc(t.title)}</h4>
    <div class="meta">${bits.join("")}</div>
    <div class="cta">${cta}</div>
  </div>`;
}


/* ---------- 定型の編集フォーム ---------- */

function readTplForm(){
  const d = ui.tplDraft, v = id => { const e = $("#"+id); return e ? e.value : ""; };
  d.title = v("tTitle"); d.note = v("tNote"); d.context = v("tCtx");
  d.minutes = +v("tMin") || 0; d.energy = v("tEne"); d.project = v("tPrj") || null;
  d.target = v("tTarget"); d.cycle = v("tCycle");
  const md = v("tMonthday"); if(md) d.monthday = Math.min(31, Math.max(1, +md || 1));
  return d;
}
function renderTplForm(){
  const d = ui.tplDraft;
  $("#pTitle").textContent = d.id ? "定型を編集" : "定型を追加";
  const opt = (arr, cur) => arr.map(([v,l]) =>
    `<option value="${esc(v)}" ${String(cur)===String(v)?"selected":""}>${esc(l)}</option>`).join("");
  const ctxOpts = opt([["","未設定"]].concat(db.contexts.map(c => [c,c])), d.context);
  const prjOpts = opt([["","なし"]].concat(db.projects.filter(p => p.status==="active").map(p => [p.id,p.name])), d.project||"");

  $("#pBody").innerHTML = `
    <div class="f"><label>行動（動詞で書く）</label>
      <input id="tTitle" value="${esc(d.title)}" placeholder="例：日報を書いて提出する"></div>
    <div class="f"><label>メモ（手順や定型文があれば）</label><textarea id="tNote">${esc(d.note)}</textarea></div>

    <div class="sect" style="font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;color:var(--ink3);margin:18px 0 9px;padding-bottom:5px;border-bottom:1px solid var(--line2)">タイミング</div>
    <div class="f"><label>周期</label><select id="tCycle">
      ${opt(Object.keys(CYCLES).map(k => [k, CYCLES[k] + (k==="adhoc" ? "（自分で選んだときだけ）" : "")]), d.cycle)}</select></div>
    ${d.cycle==="weekly" ? `<div class="f"><label>曜日（複数可）</label>
      <div class="wd">${WD.map((w,ix) =>
        `<button data-wd="${ix}" class="${(d.weekdays||[]).indexOf(ix)>=0?"on":""}">${w}</button>`).join("")}</div></div>` : ""}
    ${d.cycle==="monthly" ? `<div class="f"><label>何日（月末より大きい場合は末日）</label>
      <input type="number" id="tMonthday" min="1" max="31" value="${+d.monthday||1}"></div>` : ""}
    <div class="f"><label>投入先</label><select id="tTarget">
      ${opt([["next","次のアクション"],["calendar","カレンダー（該当日に置く）"]], d.target)}</select></div>

    <div class="sect" style="font-family:var(--f-mono);font-size:10px;letter-spacing:.14em;color:var(--ink3);margin:18px 0 9px;padding-bottom:5px;border-bottom:1px solid var(--line2)">中身</div>
    <div class="f"><label>コンテキスト</label><select id="tCtx">${ctxOpts}</select></div>
    <div class="f2">
      <div class="f"><label>所要時間</label><select id="tMin">${opt(MIN_OPT.map(([m,l])=>[m,l]), d.minutes)}</select></div>
      <div class="f"><label>エネルギー</label><select id="tEne">
        ${opt([["","—"],["high","高い"],["low","低い"]], d.energy)}</select></div>
    </div>
    <div class="f"><label>プロジェクト</label><select id="tPrj">${prjOpts}</select></div>

    <div class="p-acts">
      <button class="btn primary" id="tSave">${d.id ? "変更を保存" : "登録する"}</button>
      <button class="btn" id="tSaveRun">${d.id ? "保存して投入" : "登録して投入"}</button>
      ${d.id ? `<button class="btn danger" id="tDel">削除</button>` : ""}
    </div>`;
}
