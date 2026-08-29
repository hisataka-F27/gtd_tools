/* ---------- エラーを画面に出す（原因を追えるように） ---------- */
function showError(where, msg){
  let bar = document.getElementById("errBar");
  if(!bar){
    bar = document.createElement("div");
    bar.id = "errBar"; bar.className = "errbar";
    bar.innerHTML = `<div class="msg" id="errMsg"></div>
      <button id="errCopy">コピー</button><button id="errHide">閉じる</button>`;
    document.body.appendChild(bar);
    bar.addEventListener("click", e => {
      if(e.target.id==="errHide") bar.remove();
      if(e.target.id==="errCopy"){
        const t = document.getElementById("errMsg").textContent;
        if(navigator.clipboard) navigator.clipboard.writeText(t).catch(()=>{});
        e.target.textContent = "コピーした";
      }
    });
  }
  const line = "[" + where + "] " + msg;
  const box = document.getElementById("errMsg");
  if(box.textContent.indexOf(line) < 0) box.textContent += (box.textContent ? "\n" : "") + line;
}
window.addEventListener("error", e => showError("実行時", (e.message||"") + " @ " + (e.filename||"") + ":" + (e.lineno||"")));
window.addEventListener("unhandledrejection", e => showError("非同期", String(e.reason && e.reason.message || e.reason)));
function guard(where, fn){ return function(){ try{ return fn.apply(this, arguments); }catch(err){ showError(where, err && err.message || String(err)); } }; }
function ask(msg){ try{ return window.confirm(msg); }catch(e){ return true; } }
function tell(msg){ try{ window.alert(msg); }catch(e){ showError("通知", msg); } }
