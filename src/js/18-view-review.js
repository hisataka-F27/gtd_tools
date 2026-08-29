/* =========================================================
   週次レビュー
   ========================================================= */

const REVIEW = [
  {t:"収集トレイを空にする", lead:"残っているものを1つずつ明確化して、判断を先送りしない状態にします。",
   get:() => db.items.filter(i => i.state==="inbox"), ok:"収集トレイは空です。", jump:"inbox"},
  {t:"期限切れを拾う", lead:"日付を過ぎたまま止まっているものを、やり直すか捨てるか決めます。",
   get:overdue, ok:"期限切れはありません。", jump:"calendar"},
  {t:"待ちを督促する", lead:"預けてから1週間以上返事がないものです。催促するか、自分で引き取ります。",
   get:oldWaiting, ok:"長く放置されている依頼はありません。", jump:"waiting"},
  {t:"止まっているプロジェクトを動かす", lead:"次の一手が登録されていないプロジェクトは、事実上止まっています。",
   getP:() => db.projects.filter(p => p.status==="active" && projectNeedsAction(p)),
   ok:"すべてのプロジェクトに次の一手があります。", jump:"projects"},
  {t:"停滞したアクションを見直す", lead:"2週間以上動いていない一手です。粒度が大きすぎないか確認します。",
   get:staleNext, ok:"停滞している一手はありません。", jump:"next"},
  {t:"いつかリストを棚卸しする", lead:"今週から動かすものがあれば、次のアクションに引き上げます。",
   get:() => db.items.filter(i => i.state==="someday"), ok:"いつかリストは空です。", jump:"someday"}
];

function openReview(){ ui.review = 0; renderReview(); }
function renderReview(){
  if(ui.review===null){ $("#overlay").innerHTML = ""; return; }
  const last = ui.review >= REVIEW.length;
  let body, foot;

  if(last){
    const c = counts();
    body = `<h4>レビュー完了</h4>
      <p class="lead">今週のリストは信頼できる状態になりました。実施日を記録します。</p>
      <div class="rv-list">
        <div class="rv-item"><span class="sp">次のアクション</span><span class="tag">${c.next}</span></div>
        <div class="rv-item"><span class="sp">待ち</span><span class="tag">${c.waiting}</span></div>
        <div class="rv-item"><span class="sp">進行中プロジェクト</span><span class="tag">${c.projects}</span></div>
        <div class="rv-item"><span class="sp">収集トレイの残り</span><span class="tag">${c.inbox}</span></div>
      </div>`;
    foot = `<button class="btn" data-rv="prev">戻る</button><span style="flex:1"></span>
      <button class="btn primary" data-rv="finish">レビュー完了を記録</button>`;
  }else{
    const s = REVIEW[ui.review];
    const rows = s.getP ? s.getP() : s.get();
    body = `<h4>${esc(s.t)}</h4><p class="lead">${esc(s.lead)}</p>` +
      (rows.length ? `<div class="rv-list">${rows.map(r => {
        const isP = !!s.getP;
        const meta = isP ? "次の一手なし"
          : (r.who ? `${esc(r.who)} / ${daysSince(r.since||r.created)}日`
            : r.due ? fmtDate(r.due)
            : r.state==="next" ? `${daysSince(r.updated)}日 停滞` : "");
        return `<div class="rv-item"><span class="sp">${esc(isP ? r.name : r.title)}</span>
          ${meta?`<span class="tag">${meta}</span>`:""}
          <button class="btn sm" data-rvopen="${r.id}" data-rvp="${isP?1:0}">開く</button></div>`;
      }).join("")}</div>` : `<div class="rv-ok">${esc(s.ok)}</div>`);
    foot = `<button class="btn" data-rv="prev" ${ui.review===0?"disabled":""}>戻る</button>
      <button class="btn sm" data-rv="jump">このビューを開く</button>
      <span style="flex:1"></span>
      <span class="sub" style="font-family:var(--f-mono);font-size:10px;color:var(--ink3)">${ui.review+1} / ${REVIEW.length}</span>
      <button class="btn primary" data-rv="next">確認した</button>`;
  }
  const bars = REVIEW.map((_,ix) => `<i class="${ix < ui.review ? "done" : ix===ui.review ? "on" : ""}"></i>`).join("");
  $("#overlay").innerHTML = `<div class="ov" data-ovbg="1"><div class="sheet">
    <div class="sheet-head"><h3>週次レビュー</h3>
      <p>頭の中ではなくリストを信頼するための、週に一度の点検</p>
      <div class="prog">${bars}<i class="${last?"on":""}"></i></div></div>
    <div class="sheet-body">${body}</div>
    <div class="sheet-foot">${foot}<button class="btn" data-rv="close" style="margin-left:8px">中断</button></div>
  </div></div>`;
}
