/* ストレージが使えるか。sandbox内やプライベートモードでは
   localStorage への「アクセスそのもの」が例外を投げるので、必ず包む。 */
function store(){
  try{
    const s = window.localStorage;
    s.setItem(KEY+".probe","1"); s.removeItem(KEY+".probe");
    return s;
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
    showError("保存データ", "前回の保存データを読めませんでした（" + (e.message||e) + "）。空の状態で開始します。上書き保存される前に、必要なら書き出しでバックアップしてください。");
    return;
  }
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
function exportJSON(){
  db.build = BUILD;
  const text = JSON.stringify(db, null, 2);
  try{
    const blob = new Blob([text], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "minamo-gtd-" + today() + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
      db = d;
      normalize();
      save(); closePanel(); renderAll();
    }catch(e){ tell("このファイルは読み込めませんでした。みなもが書き出したJSONを選んでください。"); }
  };
  r.readAsText(file);
}
