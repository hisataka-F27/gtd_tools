/* ---------- 保存・読込 ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const today = () => new Date().toISOString().slice(0,10);

/* ---------- 小道具 ---------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* Enter が「送信」を意味するかどうか。
   かな漢字変換の「変換確定」も Enter キーで行うため、素朴に
   e.key==="Enter" だけを見ると、変換を確定しただけで送信されてしまい、
   文章を最後まで入力できない。変換中の Enter を除外する必要がある。
     - Chrome / Firefox … 変換中の keydown は isComposing が true
     - Safari … compositionend が keydown より先に走り isComposing が
       false になることがあるが、変換確定の keydown は keyCode 229 になる
   両方を見ることで、主要ブラウザの変換確定 Enter を送信から除外する。 */
const isSubmitEnter = e => e.key === "Enter" && !e.isComposing && e.keyCode !== 229;

const daysSince = d => d ? Math.floor((new Date(today()) - new Date(d)) / 86400000) : 0;
function fmtDate(d){
  if(!d) return "";
  const dt = new Date(d+"T00:00:00");
  return (dt.getMonth()+1) + "/" + dt.getDate() + "(" + "日月火水木金土"[dt.getDay()] + ")";
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  uid, today, esc, daysSince, fmtDate, isSubmitEnter
});
