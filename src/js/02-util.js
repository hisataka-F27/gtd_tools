/* ---------- 保存・読込 ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);

/* ---------- 小道具 ---------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const daysSince = d => d ? Math.floor((new Date(today()) - new Date(d)) / 86400000) : 0;
function fmtDate(d){
  if(!d) return "";
  const dt = new Date(d+"T00:00:00");
  return (dt.getMonth()+1) + "/" + dt.getDate() + "(" + "日月火水木金土"[dt.getDay()] + ")";
}
