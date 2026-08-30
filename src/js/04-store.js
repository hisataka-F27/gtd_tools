/* ストレージが使えるか。sandbox内やプライベートモードでは
   localStorage への「アクセスそのもの」が例外を投げるので、必ず包む。 */
function store(){
  try{
    const s = window.localStorage;
    s.setItem(KEY+".probe","1"); s.removeItem(KEY+".probe");
    return s;
  }catch(e){ return null; }
}

/* ---------- 世代バックアップ（起動時、1日1回） ---------- */
const BAK_KEY = KEY + ".bak";
const BAK_AT_KEY = KEY + ".bak.at";

/* bakAt が今日の日付でなければ退避すべき。null / 不正値でも true。
   テストのために純関数として切り出す。 */
function shouldRotateBackup(bakAt, todayStr){
  return bakAt !== todayStr;
}

/* raw（読めることが確認済みの生文字列）をそのまま .bak に退避する。
   normalize() 等の影響を受けないよう、必ず normalize() 前の文字列を渡すこと。
   失敗しても何も起きない（.bak.at を更新しない＝次回起動で再試行）。 */
function rotateBackup(s, raw){
  try{
    const at = s.getItem(BAK_AT_KEY);
    if(!shouldRotateBackup(at, today())) return;
    s.setItem(BAK_KEY, raw);
    s.setItem(BAK_AT_KEY, today());
  }catch(e){ /* 失敗しても何も起きない */ }
}

/* 退避の内容を {json, at, count} で返す。無い/読めない/parse失敗は null。 */
function readBackup(){
  const s = store();
  if(!s) return null;
  let json = null, at = null;
  try{ json = s.getItem(BAK_KEY); at = s.getItem(BAK_AT_KEY); }catch(e){ return null; }
  if(!json || !at) return null;
  try{
    const d = JSON.parse(json);
    if(!d || !Array.isArray(d.items)) return null;
    return {json, at, count: d.items.length};
  }catch(e){ return null; }
}

function load(){
  db = blank();
  const s = store();
  ui.storeOK = !!s;
  if(!s) return;
  let raw = null;
  try{ raw = s.getItem(KEY); }catch(e){ ui.storeOK = false; return; }
  if(!raw) return;
  try{
    const d = JSON.parse(raw);
    if(d && Array.isArray(d.items)) db = d;
    else throw new Error("形式が不正");
  }catch(e){
    const bak = readBackup();
    const bakNote = bak ? `　退避（${fmtDate(bak.at)} 時点・${bak.count}件）があります。設定画面から戻せます。` : "";
    showError("保存データ", "前回の保存データを読めませんでした（" + (e.message||e) + "）。空の状態で開始します。上書き保存される前に、必要なら書き出しでバックアップしてください。" + bakNote);
    return;
  }
  rotateBackup(s, raw);
  normalize();
}

let saveTimer = null;
function save(){
  db.items.forEach(i => { if(!i.updated) i.updated = today(); });
  if(!ui.storeOK) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try{
      window.localStorage.setItem(KEY, JSON.stringify(db));
      const d = new Date();
      $("#savedAt").textContent = "保存済 " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
    }catch(e){
      ui.storeOK = false;
      $("#noStore").classList.remove("hide");
      $("#savedAt").textContent = "自動保存 不可";
      showError("自動保存", (e && e.message || String(e)) + "（容量超過の可能性。書き出しでJSONを保存してください）");
    }
  }, 250);
}

/* =========================================================
   入出力
   ========================================================= */
/* text を filename としてダウンロードさせる、Blob → <a download> → クリック
   の一連。呼び出し側が失敗を検知できるよう、例外はそのまま投げる
   （フォールバック処理は呼び出し側の責務）。#8 の書き出して削除でも使う。 */
function downloadJSON(filename, text){
  const blob = new Blob([text], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function exportJSON(){
  db.build = BUILD;
  const text = JSON.stringify(db, null, 2);
  try{
    downloadJSON("nextaction-gtd-" + today() + ".json", text);
    /* 実際にダウンロードできたときだけ更新する。下のフォールバック
       （クリップボード等）に逃がした場合は、手元にファイルが残っていない
       ため更新しない。 */
    db.lastExport = today();
    save();
  }catch(e){
    /* sandbox等でダウンロードが塞がれている場合は、コピーできる形で出す */
    showError("書き出し", (e && e.message || String(e)) + "（ダウンロードが許可されていません）");
    let w = null;
    try{ w = window.open("", "_blank"); }catch(e2){ w = null; }
    if(w && w.document){ w.document.write(html`<pre>${text}</pre>`); }
    else if(navigator.clipboard){ navigator.clipboard.writeText(text)
      .then(() => tell("ダウンロードできないため、JSONをクリップボードにコピーしました。テキストエディタに貼り付けて保存してください。"))
      .catch(() => {}); }
  }
}
function importJSON(file){
  const r = new FileReader();
  r.onload = () => {
    try{
      const d = JSON.parse(r.result);
      if(!d || !Array.isArray(d.items)) throw 0;
      if(!ask("読み込んだ内容で、いま画面にあるデータを置き換えます。よろしいですか？")) return;
      snapshot("読み込み");
      db = d;
      normalize();
      save(); closePanel(); renderAll();
    }catch(e){ tell("このファイルは読み込めませんでした。" + db.appName + "が書き出したJSONを選んでください。"); }
  };
  r.readAsText(file);
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  shouldRotateBackup, readBackup, BAK_KEY, BAK_AT_KEY, downloadJSON, exportJSON
});
