/* =========================================================
   右パネル：項目編集 / プロジェクト編集
   ========================================================= */
function renderEdit(){
  const it = item(ui.sel); if(!it) return closePanel();
  $("#pTitle").textContent = "項目";
  const stOpts = Object.keys(STATES).map(k => `<option value="${k}" ${it.state===k?"selected":""}>${STATES[k].t}</option>`).join("");
  const ctxOpts = db.contexts.map(c => `<option value="${esc(c)}" ${it.context===c?"selected":""}>${esc(c)}</option>`).join("");
  const prjOpts = db.projects.filter(p => p.status==="active")
    .map(p => `<option value="${p.id}" ${it.project===p.id?"selected":""}>${esc(p.name)}</option>`).join("");
  const minOpts = MIN_OPT.map(([m,l]) => `<option value="${m}" ${it.minutes===m?"selected":""}>${l}</option>`).join("");

  $("#pBody").innerHTML = `
    <div class="f"><label>行動 / 内容</label><input id="eTitle" value="${esc(it.title)}"></div>
    <div class="f"><label>メモ</label><textarea id="eNote">${esc(it.note)}</textarea></div>
    <div class="f2">
      <div class="f"><label>置き場所</label><select id="eState">${stOpts}</select></div>
      <div class="f"><label>コンテキスト</label><select id="eCtx"><option value="">未設定</option>${ctxOpts}</select></div>
    </div>
    <div class="f2">
      <div class="f"><label>所要時間</label><select id="eMin">${minOpts}</select></div>
      <div class="f"><label>エネルギー</label><select id="eEne">
        <option value="" ${!it.energy?"selected":""}>—</option>
        <option value="high" ${it.energy==="high"?"selected":""}>高い</option>
        <option value="low" ${it.energy==="low"?"selected":""}>低い</option></select></div>
    </div>
    <div class="f2">
      <div class="f"><label>日付</label><input type="date" id="eDue" value="${it.due||""}"></div>
      <div class="f"><label>待ち相手</label><input id="eWho" value="${esc(it.who)}"></div>
    </div>
    <div class="f"><label>プロジェクト</label><select id="ePrj"><option value="">なし</option>${prjOpts}</select></div>
    <div class="p-acts">
      <button class="btn primary" id="eSave">変更を保存</button>
      ${it.state!=="done"?`<button class="btn" id="eDone">完了にする</button>`:`<button class="btn" id="eReopen">未完に戻す</button>`}
      ${it.state==="inbox"?`<button class="btn" id="eClar">明確化する</button>`:""}
      <button class="btn" id="eTpl">この項目を定型にする</button>
      <button class="btn danger" id="eDel">削除</button>
    </div>
    <div class="p-acts" style="border:none;padding-top:4px;font-family:var(--f-mono);font-size:10px;color:var(--ink3)">
      収集 ${esc(it.created)} / 更新 ${esc(it.updated)}
    </div>`;
}
function renderPrjEdit(){
  const p = prj(ui.sel); if(!p) return closePanel();
  $("#pTitle").textContent = "プロジェクト";
  const acts = db.items.filter(i => i.project===p.id);
  const open = acts.filter(i => i.state!=="done");
  $("#pBody").innerHTML = `
    <div class="f"><label>プロジェクト名</label><input id="pName" value="${esc(p.name)}"></div>
    <div class="f"><label>望む結果（完了の定義）</label><textarea id="pOut">${esc(p.outcome||"")}</textarea></div>
    ${projectNeedsAction(p) ? `<div class="notice" style="margin:0 0 13px">次の一手が登録されていません。ここで1つ足してください。</div>` : ""}
    <div class="f"><label>次の一手を追加</label><input id="pAdd" placeholder="行動を書いて Enter"></div>
    <div class="f"><label>ぶら下がっている行動 ${open.length} / ${acts.length}</label>
      <div class="rv-list">${acts.length ? acts.map(i =>
        `<div class="rv-item"><span class="sp" style="${i.state==="done"?"color:var(--ink3);text-decoration:line-through":""}">${esc(i.title)}</span>
          <span class="tag">${STATES[i.state].t}</span></div>`).join("")
        : `<div class="rv-item" style="color:var(--ink3)">まだありません</div>`}</div></div>
    <div class="p-acts">
      <button class="btn primary" id="pSave">変更を保存</button>
      <button class="btn" id="pDone">完了にする</button>
      <button class="btn danger" id="pDel">削除</button>
    </div>`;
}

function renderSettings(){
  $("#pTitle").textContent = "設定";
  const rows = db.contexts.map((c,ix) => `
    <div class="ctx-row">
      <input class="ctx-in" data-cix="${ix}" value="${esc(c)}" aria-label="コンテキスト名">
      <span class="n">${ctxUse(c)}</span>
      <button data-cmove="${ix}" data-dir="-1" ${ix===0?"disabled":""} aria-label="上へ">↑</button>
      <button data-cmove="${ix}" data-dir="1" ${ix===db.contexts.length-1?"disabled":""} aria-label="下へ">↓</button>
      <button class="x" data-cdel="${ix}" aria-label="削除">×</button>
    </div>`).join("");

  $("#pBody").innerHTML = `
    <div class="sect">CONTEXT</div>
    <div class="tip">
      コンテキストは<b>「その行動を実行するために必要な条件」</b>です。やる気ではなく制約で切ります。<br>
      判断基準はひとつだけ — <b>そのリストを実際に開く場面があるか</b>。開かないものは作らないでください。<br>
      よく効くのは、人（<b>@田中さんと</b>＝次に会ったとき話すこと）、状態（<b>@細切れ</b> / <b>@まとまった時間</b>）、場所（<b>@出社時</b>）です。
    </div>
    ${rows || `<p style="font-size:12px;color:var(--ink3);margin:0 0 10px">まだありません。</p>`}
    <div class="f" style="margin-top:12px">
      <label>追加</label>
      <input id="ctxNew" placeholder="例：@田中さんと　→ Enter">
    </div>
    <p style="font-size:11px;color:var(--ink3);margin:-6px 0 0">
      右の数字は、そのコンテキストを使っている未完了の行動数です。名前を書き換えると、使用中の行動もまとめて追従します。</p>

    <div class="sect">TOOL NAME</div>
    <div class="tip">配布したファイルごとに変えられます。受け取った人が自分で変更しても構いません。</div>
    <div class="f"><label>ツール名</label><input id="appName" value="${esc(db.appName)}"></div>
    <div class="f"><label>副題（空欄可）</label><input id="appTag" value="${esc(db.appTag)}"></div>
    <div class="p-acts"><button class="btn primary" id="appSave">名前を保存</button></div>`;
}
