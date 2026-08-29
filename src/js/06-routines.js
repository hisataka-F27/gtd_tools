/* =========================================================
   定型（ルーティン）
   ========================================================= */
function lastDateOf(y,m){ return new Date(y, m+1, 0).getDate(); }
/* その日が対象日か。月末指定（31日など）は、その月の末日に丸める */
function tplHits(t, dateStr){
  const d = new Date((dateStr||today()) + "T00:00:00");
  if(t.cycle==="daily") return true;
  if(t.cycle==="weekly") return (t.weekdays||[]).indexOf(d.getDay()) >= 0;
  if(t.cycle==="monthly"){
    const want = +t.monthday || 1, last = lastDateOf(d.getFullYear(), d.getMonth());
    return d.getDate() === Math.min(want, last);
  }
  return false;
}
const tplDue     = t => tplHits(t);
const tplRanToday= t => t.lastRun === today();
const tplPending = () => db.templates.filter(t => tplDue(t) && !tplRanToday(t));
/* 次に該当する日（カレンダー投入用）。見つからなければ今日 */
function tplNextDate(t){
  if(t.cycle==="adhoc" || t.cycle==="daily") return today();
  const base = new Date(today()+"T00:00:00");
  for(let k=0;k<400;k++){
    const d = new Date(base); d.setDate(base.getDate()+k);
    const ds = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    if(tplHits(t, ds)) return ds;
  }
  return today();
}
function cycleLabel(t){
  if(t.cycle==="weekly"){
    const w = (t.weekdays||[]).slice().sort().map(x => WD[x]).join("・");
    return "毎週 " + (w || "未指定");
  }
  if(t.cycle==="monthly") return "毎月 " + (+t.monthday || 1) + "日";
  return CYCLES[t.cycle] || "随時";
}
function tplRun(t){
  const a = newItem(t.title);
  a.note = t.note || ""; a.context = t.context || ""; a.minutes = +t.minutes || 0;
  a.energy = t.energy || ""; a.project = t.project || null; a.tpl = t.id;
  if(t.target==="calendar"){ a.state = "calendar"; a.due = tplNextDate(t); }
  else a.state = "next";
  db.items.push(a);
  t.lastRun = today();
  return a;
}
