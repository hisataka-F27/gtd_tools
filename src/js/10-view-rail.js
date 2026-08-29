/* =========================================================
   描画：左レール
   ========================================================= */
function renderRail(){
  const c = counts();
  const rows = Object.keys(STATES).filter(k => k!=="done").map(k =>
    navHTML(k, STATES[k].g, STATES[k].t, c[k], k==="inbox" && c[k]>0));
  const badPrj = db.projects.filter(p => p.status==="active" && projectNeedsAction(p)).length;
  rows.splice(4, 0, navHTML("projects","◆","プロジェクト", c.projects, badPrj>0));
  const pend = tplPending().length;
  rows.splice(5, 0, navHTML("routines","◈","定型", pend, pend>0));
  rows.push(navHTML("done","✓","完了", c.done, false));
  $("#navMain").innerHTML = rows.join("");

  $("#navCtx").innerHTML = db.contexts.map(x => {
    const n = db.items.filter(i => i.state==="next" && i.context===x).length;
    return `<button class="nav ${ui.view==="ctx:"+x?"on":""}" data-view="ctx:${esc(x)}">
      <span class="g">·</span><span class="t">${esc(x)}</span><span class="n">${n}</span></button>`;
  }).join("");

  $("#lastRev").textContent = db.review.last ? fmtDate(db.review.last) + " / " + daysSince(db.review.last) + "日前" : "未実施";
  $("#itemCount").textContent = db.items.length;
  $("#buildId").textContent = BUILD;
  $("#brandName").textContent = db.appName;
  $("#brandTag").textContent = db.appTag;
  document.title = db.appName + " — GTD ワークスペース";
}
function navHTML(v, g, t, n, alert){
  return `<button class="nav ${ui.view===v?"on":""}" data-view="${v}">
    <span class="g">${g}</span><span class="t">${esc(t)}</span>
    <span class="n ${alert?"alert":""}">${n}</span></button>`;
}
