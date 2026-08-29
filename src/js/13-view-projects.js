/* ---------- プロジェクト一覧 ---------- */
function renderProjects(){
  $("#vTitle").textContent = "プロジェクト";
  $("#vSub").textContent = "2つ以上の行動が必要な、望む結果";
  let act = db.projects.filter(p => p.status==="active");
  if(ui.q){
    const q = ui.q.toLowerCase();
    act = act.filter(p => (p.name + " " + (p.outcome||"")).toLowerCase().includes(q)
      || db.items.some(i => i.project===p.id && haystack(i).includes(q)));
  }
  if(!act.length){
    $("#list").innerHTML = ui.q
      ? html`<div class="empty"><span class="mk">◆</span><h3>該当なし</h3><p>「${ui.q}」に一致するプロジェクトはありません。</p></div>`
      : emptyHTML("projects");
    return;
  }
  $("#list").innerHTML = `<div class="prjs">` + act.map(p => {
    const open = db.items.filter(i => i.project===p.id && i.state!=="done").length;
    const done = db.items.filter(i => i.project===p.id && i.state==="done").length;
    const need = projectNeedsAction(p);
    /* ネストした html`` の結果（既にエスケープ済みの断片）を外側テンプレートに埋め込むときは、
       二重エスケープを避けるため raw() で包む。 */
    return html`<div class="prj" data-prj="${p.id}">
      <h4>${p.name}</h4>
      ${p.outcome?raw(html`<p class="out">${p.outcome}</p>`):""}
      <div class="st"><span>未完 ${open}</span><span>完了 ${done}</span>
        ${need?raw(`<span class="warn">次の一手なし</span>`):""}</div>
    </div>`;
  }).join("") + `</div>`;
}
