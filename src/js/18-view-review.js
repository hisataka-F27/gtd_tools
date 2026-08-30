/* =========================================================
   週次レビュー
   ========================================================= */

/* acts: この節の行に出す行内操作の種類（宣言的に持たせる。描画側に節ごとの
   if 分岐を書かない）。無い節（またはプロジェクトの節 = getP を持つ節）は
   従来どおり「開く」だけを出す。割り当ては PLAN-P1.md ステップB の表のとおり。 */
const REVIEW = [
  {t:"収集トレイを空にする", lead:"残っているものを1つずつ明確化して、判断を先送りしない状態にします。",
   get:() => db.items.filter(i => i.state==="inbox"), ok:"収集トレイは空です。", jump:"inbox",
   acts:["done"]},
  {t:"期限切れを拾う", lead:"日付を過ぎたまま止まっているものを、やり直すか捨てるか決めます。",
   get:overdue, ok:"期限切れはありません。", jump:"calendar",
   acts:["done","someday"]},
  {t:"待ちを督促する", lead:"預けてから1週間以上返事がないものです。催促するか、自分で引き取ります。",
   get:oldWaiting, ok:"長く放置されている依頼はありません。", jump:"waiting",
   acts:["done","next"]},
  {t:"止まっているプロジェクトを動かす", lead:"次の一手が登録されていないプロジェクトは、事実上止まっています。",
   getP:() => db.projects.filter(p => p.status==="active" && projectNeedsAction(p)),
   ok:"すべてのプロジェクトに次の一手があります。", jump:"projects"},
  {t:"停滞したアクションを見直す", lead:"2週間以上動いていない一手です。粒度が大きすぎないか確認します。",
   get:staleNext, ok:"停滞している一手はありません。", jump:"next",
   acts:["done","someday","today"]},
  {t:"いつかリストを棚卸しする", lead:"今週から動かすものがあれば、次のアクションに引き上げます。",
   get:() => db.items.filter(i => i.state==="someday"), ok:"いつかリストは空です。", jump:"someday",
   acts:["done","next","today"]}
];

const REVIEW_ACT_LABEL = {done:"完了", someday:"いつかへ", next:"次へ", today:"今日"};

/* applyReviewAct(it, act): レビュー行内操作の状態遷移そのもの。
   引数の item を書き換えるだけの純関数（save も描画もしない）。
   today は state も "next" にする。isToday() が state==="next" を条件に
   含むため、いつか等の項目に印だけ付けても「今日やる」ビューに出てこない。
   一体で state を next に上げることで、その場で「今日やる」に反映される。 */
function applyReviewAct(it, act){
  if(act==="done"){ it.state = "done"; it.doneAt = today(); it.updated = today(); }
  else if(act==="someday"){ it.state = "someday"; it.updated = today(); }
  else if(act==="next"){ it.state = "next"; it.updated = today(); }
  /* today も updated を進める。「停滞したアクション」の節は updated からの
     経過日数で拾うため（staleNext、05-query.js）、その場で今日やると決めた
     ものが翌週も停滞として並び続けるのを避ける。 */
  else if(act==="today"){ it.state = "next"; it.flagged = today(); it.updated = today(); }
  return it;
}

function openReview(){ ui.review = 0; renderReview(); }
function renderReview(){
  if(ui.review===null){ $("#overlay").innerHTML = ""; return; }
  const last = ui.review >= REVIEW.length;
  let body, foot;

  if(last){
    const c = counts();
    body = html`<h4>レビュー完了</h4>
      <p class="lead">今週のリストは信頼できる状態になりました。実施日を記録します。</p>
      <div class="rv-list">
        <div class="rv-item"><span class="sp">次のアクション</span><span class="tag">${c.next}</span></div>
        <div class="rv-item"><span class="sp">待ち</span><span class="tag">${c.waiting}</span></div>
        <div class="rv-item"><span class="sp">進行中プロジェクト</span><span class="tag">${c.projects}</span></div>
        <div class="rv-item"><span class="sp">収集トレイの残り</span><span class="tag">${c.inbox}</span></div>
      </div>`;
    foot = html`<button class="btn" data-rv="prev">戻る</button><span style="flex:1"></span>
      <button class="btn primary" data-rv="finish">レビュー完了を記録</button>`;
  }else{
    const s = REVIEW[ui.review];
    const rows = s.getP ? s.getP() : s.get();
    const rowsHTML = rows.map(r => {
      const isP = !!s.getP;
      const meta = isP ? "次の一手なし"
        : (r.who ? html`${r.who} / ${daysSince(r.since||r.created)}日`
          : r.due ? fmtDate(r.due)
          : r.state==="next" ? `${daysSince(r.updated)}日 停滞` : "");
      const actsHTML = (s.acts||[]).map(act =>
        html`<button class="btn sm" data-rvact="${act}" data-rvid="${r.id}">${REVIEW_ACT_LABEL[act]}</button>`
      ).join("");
      return html`<div class="rv-item"><span class="sp">${isP ? r.name : r.title}</span>
          ${meta?raw(html`<span class="tag">${raw(meta)}</span>`):""}
          <span class="rv-acts">${raw(actsHTML)}<button class="btn sm" data-rvopen="${r.id}" data-rvp="${isP?1:0}">開く</button></span></div>`;
    }).join("");
    body = html`<h4>${s.t}</h4><p class="lead">${s.lead}</p>${
      rows.length ? raw(html`<div class="rv-list">${raw(rowsHTML)}</div>`) : raw(html`<div class="rv-ok">${s.ok}</div>`)}`;
    foot = html`<button class="btn" data-rv="prev" ${ui.review===0?"disabled":""}>戻る</button>
      <button class="btn sm" data-rv="jump">このビューを開く</button>
      <span style="flex:1"></span>
      <span class="sub" style="font-family:var(--f-mono);font-size:10px;color:var(--ink3)">${ui.review+1} / ${REVIEW.length}</span>
      <button class="btn primary" data-rv="next">確認した</button>`;
  }
  const bars = raw(REVIEW.map((_,ix) => html`<i class="${ix < ui.review ? "done" : ix===ui.review ? "on" : ""}"></i>`).join(""));
  $("#overlay").innerHTML = html`<div class="ov" data-ovbg="1"><div class="sheet">
    <div class="sheet-head"><h3>週次レビュー</h3>
      <p>頭の中ではなくリストを信頼するための、週に一度の点検</p>
      <div class="prog">${bars}<i class="${last?"on":""}"></i></div></div>
    <div class="sheet-body">${raw(body)}</div>
    <div class="sheet-foot">${raw(foot)}<button class="btn" data-rv="close" style="margin-left:8px">中断</button></div>
  </div></div>`;
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  REVIEW, REVIEW_ACT_LABEL, applyReviewAct
});
