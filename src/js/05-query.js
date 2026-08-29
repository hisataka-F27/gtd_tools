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
