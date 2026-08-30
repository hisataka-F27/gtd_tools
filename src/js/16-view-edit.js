/* =========================================================
   右パネル：項目編集 / プロジェクト編集
   ========================================================= */
function renderEdit(){
  const it = item(ui.sel); if(!it) return closePanel();
  $("#pTitle").textContent = "項目";
  const stOpts = raw(Object.keys(STATES).map(k => html`<option value="${k}" ${it.state===k?"selected":""}>${STATES[k].t}</option>`).join(""));
  const ctxOpts = raw(db.contexts.map(c => html`<option value="${c}" ${it.context===c?"selected":""}>${c}</option>`).join(""));
  const prjOpts = raw(db.projects.filter(p => p.status==="active")
    .map(p => html`<option value="${p.id}" ${it.project===p.id?"selected":""}>${p.name}</option>`).join(""));
  const minOpts = raw(MIN_OPT.map(([m,l]) => html`<option value="${m}" ${it.minutes===m?"selected":""}>${l}</option>`).join(""));

  $("#pBody").innerHTML = html`
    <div class="f"><label>行動 / 内容</label><input id="eTitle" value="${it.title}"></div>
    <div class="f"><label>メモ</label><textarea id="eNote">${it.note}</textarea></div>
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
      <div class="f"><label>待ち相手</label><input id="eWho" value="${it.who}"></div>
    </div>
    <div class="f"><label>プロジェクト</label><select id="ePrj"><option value="">なし</option>${prjOpts}</select></div>
    <div class="p-acts">
      <button class="btn primary" id="eSave">変更を保存</button>
      ${it.state!=="done"?raw(`<button class="btn" id="eDone">完了にする</button>`):raw(`<button class="btn" id="eReopen">未完に戻す</button>`)}
      ${it.state==="inbox"?raw(`<button class="btn" id="eClar">明確化する</button>`):""}
      <button class="btn" id="eTpl">この項目を定型にする</button>
      <button class="btn danger" id="eDel">削除</button>
    </div>
    <div class="p-acts" style="border:none;padding-top:4px;font-family:var(--f-mono);font-size:10px;color:var(--ink3)">
      収集 ${it.created} / 更新 ${it.updated}
    </div>`;
}
function renderPrjEdit(){
  const p = prj(ui.sel); if(!p) return closePanel();
  $("#pTitle").textContent = "プロジェクト";
  const acts = db.items.filter(i => i.project===p.id);
  const open = acts.filter(i => i.state!=="done");
  $("#pBody").innerHTML = html`
    <div class="f"><label>プロジェクト名</label><input id="pName" value="${p.name}"></div>
    <div class="f"><label>望む結果（完了の定義）</label><textarea id="pOut">${p.outcome||""}</textarea></div>
    ${projectNeedsAction(p) ? raw(`<div class="notice" style="margin:0 0 13px">次の一手が登録されていません。ここで1つ足してください。</div>`) : ""}
    <div class="f"><label>次の一手を追加</label><input id="pAdd" placeholder="行動を書いて Enter"></div>
    <div class="f"><label>ぶら下がっている行動 ${open.length} / ${acts.length}</label>
      <div class="rv-list">${acts.length ? raw(acts.map(i =>
        html`<div class="rv-item"><span class="sp" style="${i.state==="done"?"color:var(--ink3);text-decoration:line-through":""}">${i.title}</span>
          <span class="tag">${STATES[i.state].t}</span></div>`).join(""))
        : raw(`<div class="rv-item" style="color:var(--ink3)">まだありません</div>`)}</div></div>
    <div class="p-acts">
      <button class="btn primary" id="pSave">変更を保存</button>
      <button class="btn" id="pDone">完了にする</button>
      <button class="btn danger" id="pDel">削除</button>
    </div>`;
}

function renderSettings(){
  $("#pTitle").textContent = "設定";
  const rows = db.contexts.map((c,ix) => html`
    <div class="ctx-row">
      <input class="ctx-in" data-cix="${ix}" value="${c}" aria-label="コンテキスト名">
      <span class="n">${ctxUse(c)}</span>
      <button data-cmove="${ix}" data-dir="-1" ${ix===0?"disabled":""} aria-label="上へ">↑</button>
      <button data-cmove="${ix}" data-dir="1" ${ix===db.contexts.length-1?"disabled":""} aria-label="下へ">↓</button>
      <button class="x" data-cdel="${ix}" aria-label="削除">×</button>
    </div>`).join("");

  $("#pBody").innerHTML = html`
    <div class="sect">CONTEXT</div>
    <div class="tip">
      コンテキストは<b>「その行動を実行するために必要な条件」</b>です。やる気ではなく制約で切ります。<br>
      判断基準はひとつだけ — <b>そのリストを実際に開く場面があるか</b>。開かないものは作らないでください。<br>
      よく効くのは、人（<b>@田中さんと</b>＝次に会ったとき話すこと）、状態（<b>@細切れ</b> / <b>@まとまった時間</b>）、場所（<b>@出社時</b>）です。
    </div>
    ${rows ? raw(rows) : raw(`<p style="font-size:12px;color:var(--ink3);margin:0 0 10px">まだありません。</p>`)}
    <div class="f" style="margin-top:12px">
      <label>追加</label>
      <input id="ctxNew" placeholder="例：@田中さんと　→ Enter">
    </div>
    <p style="font-size:11px;color:var(--ink3);margin:-6px 0 0">
      右の数字は、そのコンテキストを使っている未完了の行動数です。名前を書き換えると、使用中の行動もまとめて追従します。</p>

    <div class="sect">TOOL NAME</div>
    <div class="tip">配布したファイルごとに変えられます。受け取った人が自分で変更しても構いません。</div>
    <div class="f"><label>ツール名</label><input id="appName" value="${db.appName}"></div>
    <div class="f"><label>副題（空欄可）</label><input id="appTag" value="${db.appTag}"></div>
    <div class="p-acts"><button class="btn primary" id="appSave">名前を保存</button></div>

    <div class="sect">バックアップ</div>
    ${(() => {
      const bak = readBackup();
      if(!bak) return raw(`<div class="tip">まだ退避がありません（次回この画面を開いた日に作られます）。</div>`);
      return raw(html`
        <div class="tip">${fmtDate(bak.at)} 時点の状態（${bak.count}件）を退避しています。</div>
        <div class="p-acts"><button class="btn danger" id="bakRestore">この状態に戻す</button></div>`);
    })()}`;
}
