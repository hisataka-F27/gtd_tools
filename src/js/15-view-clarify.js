/* =========================================================
   右パネル：明確化フロー（署名要素）
   ========================================================= */
const TREE = {
  q1:{q:"これは、行動が必要なもの？", hint:"必要ないなら、捨てるか・残すかを決めます。",
      opts:[
        {t:"行動が必要", s:"はい", go:"q2"},
        {t:"資料として残す", s:"いいえ・残す", act:"reference"},
        {t:"いつか / たぶん", s:"いいえ・保留", act:"someday"},
        {t:"捨てる", s:"いいえ・破棄", act:"trash"}
      ]},
  q2:{q:"2分以内で終わる？", hint:"終わるなら、いま片づけるのが最短です。",
      opts:[{t:"いま片づけた（完了にする）", s:"はい", act:"done"},{t:"2分では終わらない", s:"いいえ", go:"q3"}]},
  q3:{q:"自分がやるべき？", hint:"人に任せるなら、誰に預けたかを記録します。",
      opts:[{t:"自分でやる", s:"はい", go:"q4"},{t:"人に任せる", s:"いいえ", form:"waiting"}]},
  q4:{q:"1回の行動で終わる？", hint:"2つ以上の行動が要るならプロジェクトです。",
      opts:[{t:"1回の行動で終わる", s:"はい", go:"q5"},{t:"複数の行動が必要", s:"いいえ", form:"project"}]},
  q5:{q:"特定の日にやる？", hint:"その日でなければ意味がないものだけカレンダーへ。",
      opts:[{t:"日付が決まっている", s:"はい", form:"calendar"},{t:"手が空いたときにやる", s:"いいえ", form:"next"}]}
};

function openClarify(id){
  ui.sel = id; ui.clar = {step:"q1", path:[]};
  showPanel(); renderAll();
}
function renderClarify(){
  const it = item(ui.sel); if(!it) return closePanel();
  /* renderClarify() は renderPanel() が「ui.clar が真のときだけ」呼ぶため、
     通常の描画経路では ui.clar は必ず存在する。ここでのガードは通常系の
     見た目を一切変えず、それ以外の経路から誤って呼ばれた場合の保険として
     #eTpl / #fBack と同じ構えを揃えるためのもの。 */
  if(!ui.clar) return closePanel();
  $("#pTitle").textContent = "明確化";
  const past = raw(ui.clar.path.map(p =>
    html`<div class="step past"><div class="q">${TREE[p.k].q}<span class="ans">${p.s}</span></div></div>`).join(""));

  let cur;
  if(ui.clar.form){
    cur = raw(formHTML(ui.clar.form, it));
  }else{
    const n = TREE[ui.clar.step];
    const opts = raw(n.opts.map((o,ix) =>
      html`<button class="opt" data-opt="${ix}">${o.t}</button>`).join(""));
    cur = raw(html`<div class="step now">
      <div class="q">${n.q}</div><div class="hint">${n.hint}</div>
      <div class="opts">${opts}</div></div>`);
  }
  $("#pBody").innerHTML = html`<div class="subj">${it.title}</div>
     <div class="clar">${past}${cur}</div>
     <div class="p-acts">
       <button class="btn sm" id="clarRestart">最初からやり直す</button>
       <button class="btn sm" id="clarEdit">項目を直接編集</button>
     </div>`;
}
/* formHTML() は既にエスケープ済みのHTML文字列を返す（呼び出し側 renderClarify() で raw() 済み）。 */
function formHTML(kind, it){
  const ctxOpts = raw(db.contexts.map(c => html`<option value="${c}">${c}</option>`).join(""));
  const prjOpts = raw(db.projects.filter(p => p.status==="active")
    .map(p => html`<option value="${p.id}">${p.name}</option>`).join(""));
  const minOpts = raw(MIN_OPT.map(([m,l]) => html`<option value="${m}">${l}</option>`).join(""));
  const common = html`
    <div class="f2">
      <div class="f"><label>所要時間の目安</label><select id="fMin">${minOpts}</select></div>
      <div class="f"><label>エネルギー</label><select id="fEne">
        <option value="">—</option><option value="high">高い</option><option value="low">低い</option></select></div>
    </div>
    <div class="f"><label>関連プロジェクト</label><select id="fPrj">
      <option value="">なし</option>${prjOpts}</select></div>`;

  if(kind==="waiting") return html`<div class="step now">
    <div class="q">誰に預けた？</div>
    <div class="f" style="margin-top:9px"><label>相手</label><input id="fWho" placeholder="例：田中さん / 情シス"></div>
    <div class="f"><label>依頼した日</label><input type="date" id="fSince" value="${today()}"></div>
    <div class="f"><label>次の一手（自分の待ち方）</label><input id="fTitle" value="${it.title}"></div>
    <div class="f"><label>関連プロジェクト</label><select id="fPrj"><option value="">なし</option>${prjOpts}</select></div>
    <div class="p-acts"><button class="btn primary" id="fSave">待ちリストへ</button>
      <button class="btn" id="fBack">戻る</button></div></div>`;

  if(kind==="calendar") return html`<div class="step now">
    <div class="q">いつやる？</div>
    <div class="f" style="margin-top:9px"><label>日付</label><input type="date" id="fDue" value="${today()}"></div>
    <div class="f"><label>行動（動詞で書く）</label><input id="fTitle" value="${it.title}"></div>
    ${raw(common)}
    <div class="p-acts"><button class="btn primary" id="fSave">カレンダーへ</button>
      <button class="btn" id="fBack">戻る</button></div></div>`;

  if(kind==="next") return html`<div class="step now">
    <div class="q">次の一手は？</div>
    <div class="hint">「〜に電話する」「〜のたたきを書く」のように、迷わず手が動く形にします。</div>
    <div class="f" style="margin-top:9px"><label>行動</label><input id="fTitle" value="${it.title}"></div>
    <div class="f"><label>コンテキスト（どこで・何があればできるか）</label>
      <select id="fCtx"><option value="">未設定</option>${ctxOpts}</select></div>
    ${raw(common)}
    <div class="p-acts"><button class="btn primary" id="fSave">次のアクションへ</button>
      <button class="btn" id="fBack">戻る</button></div></div>`;

  if(kind==="project") return html`<div class="step now">
    <div class="q">望む結果は？</div>
    <div class="hint">終わったと言える状態を先に決めてから、最初の一手を書きます。</div>
    <div class="f" style="margin-top:9px"><label>プロジェクト名</label><input id="fPName" value="${it.title}"></div>
    <div class="f"><label>望む結果（完了の定義）</label><textarea id="fOut" placeholder="例：新ツールの運用手順書が部内に配布され、質問が来ない状態"></textarea></div>
    <div class="f"><label>最初の次の一手</label><input id="fFirst" placeholder="例：現行手順の画面キャプチャを集める"></div>
    <div class="f"><label>その一手のコンテキスト</label>
      <select id="fCtx"><option value="">未設定</option>${ctxOpts}</select></div>
    <div class="p-acts"><button class="btn primary" id="fSave">プロジェクトを作る</button>
      <button class="btn" id="fBack">戻る</button></div></div>`;
  return "";
}
function clarChoose(ix){
  /* [data-opt] ボタンは明確化フローの選択肢表示中しか存在しないが、
     ui.clar が外れた状態で呼ばれても例外を投げないようにしておく。 */
  if(!ui.clar) return;
  const n = TREE[ui.clar.step], o = n.opts[ix], it = item(ui.sel);
  ui.clar.path.push({k:ui.clar.step, s:o.s});
  if(o.go){ ui.clar.step = o.go; renderAll(); return; }
  if(o.form){ ui.clar.form = o.form; renderAll(); return; }
  if(o.act==="trash"){ db.items = db.items.filter(x => x.id!==it.id); }
  else if(o.act==="done"){ it.state = "done"; it.doneAt = today(); it.updated = today(); }
  else { it.state = o.act; it.updated = today(); }
  save(); closePanel(); renderAll();
}
function clarSubmit(){
  /* #fSave も明確化フローのフォーム表示中しか存在しないが、同様にガードしておく。 */
  if(!ui.clar) return;
  snapshot("明確化");
  const it = item(ui.sel), k = ui.clar.form;
  const val = id => { const el = $("#"+id); return el ? el.value.trim() : ""; };
  if(k==="waiting"){
    it.title = val("fTitle") || it.title; it.who = val("fWho") || "先方";
    it.since = val("fSince") || today(); it.project = val("fPrj") || null; it.state = "waiting";
  }else if(k==="calendar"){
    it.title = val("fTitle") || it.title; it.due = val("fDue") || today();
    it.minutes = +val("fMin") || 0; it.energy = val("fEne"); it.project = val("fPrj") || null; it.state = "calendar";
  }else if(k==="next"){
    it.title = val("fTitle") || it.title; it.context = val("fCtx");
    it.minutes = +val("fMin") || 0; it.energy = val("fEne"); it.project = val("fPrj") || null; it.state = "next";
  }else if(k==="project"){
    const p = {id:uid(), name:val("fPName") || it.title, outcome:val("fOut"), status:"active", created:today()};
    db.projects.push(p);
    const first = val("fFirst");
    if(first){
      const a = newItem(first); a.state = "next"; a.context = val("fCtx"); a.project = p.id;
      db.items.push(a);
    }
    db.items = db.items.filter(x => x.id!==it.id);
    save(); closePanel(); ui.view = "projects"; renderAll(); return;
  }
  it.updated = today();
  save(); closePanel(); renderAll();
}
