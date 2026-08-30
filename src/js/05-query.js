/* ---------- 集計 ---------- */
function counts(){
  const c = {};
  Object.keys(STATES).forEach(k => c[k] = db.items.filter(i => i.state===k).length);
  c.projects = db.projects.filter(p => p.status==="active").length;
  return c;
}
function projectNeedsAction(p){
  return !db.items.some(i => i.project===p.id && (i.state==="next" || i.state==="calendar" || i.state==="waiting"));
}
const staleNext  = () => db.items.filter(i => i.state==="next" && daysSince(i.updated) >= 14);
const oldWaiting = () => db.items.filter(i => i.state==="waiting" && daysSince(i.since || i.created) >= 7);
const overdue    = () => db.items.filter(i => i.state!=="done" && i.due && i.due < today());

function haystack(i){
  const p = i.project ? prj(i.project) : null;
  return [i.title, i.note, i.who, i.context, p && p.name, p && p.outcome]
    .filter(Boolean).join(" ").toLowerCase();
}
function visible(list){
  if(!ui.q) return list;
  const q = ui.q.toLowerCase();
  return list.filter(i => haystack(i).includes(q));
}

function ctxUse(c){ return db.items.filter(i => i.state!=="done" && i.context===c).length; }

/* isToday(i): 「今日やる」印が今日付いているか。
   flagged は「印を付けた日」の文字列なので、日付が変われば自然に false になる
   （掃除処理は不要）。state==="next" もここで判定に含める。state が next 以外に
   変わった項目は flagged をそのまま残す（消しに行かない）ため、印を付けたまま
   いつか等へ送っても表示には出ず、next に戻ってきた当日なら再び出る。 */
function isToday(i){
  return i.state==="next" && i.flagged===today();
}
const todayItems = () => db.items.filter(isToday);

/* ---- カーソル（j/k キー操作） ---- */
/* orderedIds(view): listGroups(view) の「画面に出る順序そのもの」を id の配列に平らにしたもの。
   j/k の移動順序は必ずこれを出所にする（renderList() の描画順とズレさせないため）。 */
function orderedIds(view){
  return listGroups(view).flatMap(g => g.items.map(i => i.id));
}
/* moveCursor(ids, cur, delta): 描画に依存しない純関数。
   cur が ids に無い id のとき（該当なし・null 含む）は先頭から数える。
   先頭で delta=-1 / 末尾で delta=+1 は動かさない（巻き戻さない）。
   ids が空のときは null。 */
function moveCursor(ids, cur, delta){
  if(!ids.length) return null;
  const ix = ids.indexOf(cur);
  if(ix < 0) return ids[0];
  const next = ix + delta;
  if(next < 0 || next >= ids.length) return ids[ix];
  return ids[next];
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  counts, projectNeedsAction, staleNext, oldWaiting, overdue, haystack, visible, ctxUse,
  orderedIds, moveCursor, isToday, todayItems
});
