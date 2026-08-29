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
      ? `<div class="empty"><span class="mk">◆</span><h3>該当なし</h3><p>「${esc(ui.q)}」に一致するプロジェクトはありません。</p></div>`
      : emptyHTML("projects");
    return;
  }
  $("#list").innerHTML = `<div class="prjs">` + act.map(p => {
    const open = db.items.filter(i => i.project===p.id && i.state!=="done").length;
    const done = db.items.filter(i => i.project===p.id && i.state==="done").length;
    const need = projectNeedsAction(p);
    return `<div class="prj" data-prj="${p.id}">
      <h4>${esc(p.name)}</h4>
      ${p.outcome?`<p class="out">${esc(p.outcome)}</p>`:""}
      <div class="st"><span>未完 ${open}</span><span>完了 ${done}</span>
        ${need?`<span class="warn">次の一手なし</span>`:""}</div>
    </div>`;
  }).join("") + `</div>`;
}
