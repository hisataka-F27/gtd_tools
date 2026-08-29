"use strict";
/* =========================================================
   test/phase4-actions-equivalence.test.js

   Phase 4（click / input / change×2 / keydown ハンドラの解体）が
   「移動のみ」であることを機械的に検証する。

   commit 6283bb5（Phase 4着手直前のHEAD、src/js/90-app.js に
   全ハンドラが集約されていた版）を git show で取り出し、各 if 分岐の
   中身（波括弧の中）を、現在の src/js/30-actions.js の対応する関数の
   中身と比較する。

   分岐内でイベント要素の dataset を直接読んでいた箇所は、
   呼び出し側（40-events.js）が読んで引数として渡す形に変わっているため、
   その「束縛の置き換え」だけを before→after のテキスト置換として
   明示的に列挙し、それ以外の一文字でも差分があれば FAIL する。
   置換ゼロのエントリ（下記 subs:[]）は「一字一句そのまま」を意味する。
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PRE_PHASE4_COMMIT = "6283bb5";
const oldSrc = execSync(`git show ${PRE_PHASE4_COMMIT}:src/js/90-app.js`, {
  cwd: path.join(__dirname, ".."),
  encoding: "utf8"
});
const actionsSrc = fs.readFileSync(path.join(__dirname, "..", "src", "js", "30-actions.js"), "utf8");
const eventsSrc = fs.readFileSync(path.join(__dirname, "..", "src", "js", "40-events.js"), "utf8");

/* text 内で anchor (最初の出現) の直後にある最初の "{" から、
   対応する "}" までの中身（内側のみ、前後の括弧は含まない）を返す。
   コード中の波括弧の出現がテンプレートリテラルの ${...} を含めて
   常に対で閉じている（今回対象の全分岐で確認済み）ことを利用した、
   素朴な深さカウント方式。 */
function extractBraceBlock(text, anchor, occurrenceIndex = 0){
  let searchFrom = 0;
  let anchorAt = -1;
  for(let i = 0; i <= occurrenceIndex; i++){
    anchorAt = text.indexOf(anchor, searchFrom);
    if(anchorAt < 0) throw new Error(`anchor not found: ${JSON.stringify(anchor)} (occurrence ${i})`);
    searchFrom = anchorAt + anchor.length;
  }
  const braceAt = text.indexOf("{", anchorAt);
  if(braceAt < 0) throw new Error(`no "{" after anchor: ${JSON.stringify(anchor)}`);
  let depth = 0, i = braceAt;
  for(; i < text.length; i++){
    if(text[i] === "{") depth++;
    else if(text[i] === "}"){
      depth--;
      if(depth === 0) break;
    }
  }
  if(depth !== 0) throw new Error(`unbalanced braces after anchor: ${JSON.stringify(anchor)}`);
  return text.slice(braceAt + 1, i);
}

function extractFunctionBody(text, fnName){
  const anchor = new RegExp(`function ${fnName}\\s*\\([^)]*\\)\\s*\\{`).exec(text);
  if(!anchor) throw new Error(`function not found: ${fnName}`);
  const braceAt = anchor.index + anchor[0].length - 1;
  let depth = 0, i = braceAt;
  for(; i < text.length; i++){
    if(text[i] === "{") depth++;
    else if(text[i] === "}"){
      depth--;
      if(depth === 0) break;
    }
  }
  if(depth !== 0) throw new Error(`unbalanced braces in function: ${fnName}`);
  return text.slice(braceAt + 1, i);
}

/* 比較用正規化：連続空白を1つに畳み、前後をtrim。
   インデント差・改行位置の差だけを無視し、トークン順序・語句は一切変えない。 */
function norm(s){
  return s.replace(/\s+/g, " ").trim();
}

function applySubs(s, subs){
  let out = s;
  for(const [from, to] of subs){
    const before = out;
    out = out.replace(from, to);
    assert.notEqual(out, before, `置換が一致箇所ゼロだった: ${from}`);
  }
  return out;
}

/* ---- 対応表 ----
   each entry:
   - name: 報告用の見出し
   - oldAnchor / oldOccurrence: 旧 90-app.js（commit 6283bb5）内でのブロック位置
   - newFn / newSrc: 新しい関数と、それを含むファイルのソーステキスト
   - subs: [oldPattern, replacement] の配列。dataset読み取り→引数化などの
     「束縛の置き換え」のみを表す。ロジック変更があればここに現れない差分として検出される。
*/
/* ---- Phase 5: 描画呼び出しの一本化による置換 ----
   renderAll() = renderRail() + renderFilters() + renderList() + renderPanel()（90-app.js 参照）。
   Phase 4 時点の各分岐が呼んでいた描画関数の「組み合わせ」を renderAll() 1つに寄せた箇所だけを、
   ここで before → after の置換として明示する。これ以外の差分が出れば FAIL する＝
   renderAll() への置き換え以外のロジック変更が紛れ込んでいないことを保証する網になっている。 */
const RENDER_UNIFY_TO_ALL_PANEL = [/renderPanel\(\);/, "renderAll();"];
const RENDER_UNIFY_LIST_PANEL = [/renderList\(\); renderPanel\(\);/, "renderAll();"];
const RENDER_UNIFY_FILTERS_LIST = [/renderFilters\(\); renderList\(\);/, "renderAll();"];
const RENDER_UNIFY_CLOSE_LIST = [/closePanel\(\); renderList\(\);/, "closePanel(); renderAll();"];

/* ---- リファクタ後の意図的な挙動変更 ----
   ここから下は「純粋な移動」ではなく、リファクタ完了後にユーザ要望で
   入れた挙動の変更。等価性の網を外さずに済むよう、変更点だけを
   before → after の置換として明示的に記録する。
   （これを書かずにテストを消す・skip するのは禁止。何がいつ変わったのかを
     追えなくなるため。）

   #pAdd: 行動を追加したあと入力欄へフォーカスを戻す1行を追加した。
   元は追加のたびにフォーカスが外れ、続けて入力できなかった。
   #ctxNew（addContextNew）や収集欄（capture）と同じ挙動に揃えたもの。 */
const PADD_REFOCUS = [
  /db\.items\.push\(a\); save\(\); renderPanel\(\); renderRail\(\);/,
  'db.items.push(a); save(); renderPanel(); renderRail();\n' +
  '  /* renderPanel() が #pAdd ごと作り直すためフォーカスが外れる。\n' +
  '     行動は続けて何件も足すことが多いので、収集欄(capture)や\n' +
  '     コンテキスト追加(addContextNew)と同じく入力欄へ戻す。\n' +
  '     作り直された後の要素を引き直す必要があるため el は使えない。 */\n' +
  '  const f = $("#pAdd"); if(f) f.focus();'
];

/* #eTpl / #fBack: 対象が見つからないときに例外を投げていた箇所へ
   早期 return のガードを足した（REFACTOR_PLAN.md §8 の2件）。
   元は `guard()` に捕まって赤いエラーバーが出るだけだったが、
   何もしないのが正しい振る舞いのため。 */
const ETPL_NULL_GUARD = [
  /const it = item\(id\);/,
  'const it = item(id);\n' +
  '  /* ui.sel は項目IDのほかプロジェクトID・"__tpl__"・"__settings__" も取る。\n' +
  '     項目が見つからない状態でこれが呼ばれたら、例外を投げず何もしない\n' +
  '     （定型のカード実行 runTemplate と同じ構え）。 */\n' +
  '  if(!it) return;'
];
const FBACK_NULL_GUARD = [
  /^\s*ui\.clar\.form = null;/,
  '  /* 明確化フロー表示中しか #fBack は存在しないが、ui.clar が\n' +
  '     外れた状態で呼ばれても例外を投げないようにしておく。 */\n' +
  '  if(!ui.clar) return;\n' +
  '  ui.clar.form = null;'
];

/* #eSave / #eDone / #eReopen / #pSave / #pDone: #eTpl / #fBack と同種の
   未ガード参照（REFACTOR_PLAN.md §8 の残り）。item(ui.sel) / prj(ui.sel) が
   undefined を返しうる状態で呼ばれても例外を投げず何もしないようにした。
   #eDel / #pDel / deleteProject は item()/prj() を呼んでおらず
   （id の不一致は filter が黙って no-op にする）、同種の問題がないため対象外。 */
const ESAVE_NULL_GUARD = [
  /const it = item\(ui\.sel\);/,
  'const it = item(ui.sel);\n' +
  '  /* #eSave は項目編集パネル表示中しか存在しないが、ui.sel が\n' +
  '     外れた状態で呼ばれても例外を投げないようにしておく。 */\n' +
  '  if(!it) return;'
];
const EDONE_NULL_GUARD = [
  /const it = item\(ui\.sel\); it\.state = "done";/,
  'const it = item(ui.sel);\n' +
  '  /* #eDone も項目編集パネル表示中しか存在しないが、同様にガードしておく。 */\n' +
  '  if(!it) return;\n' +
  '  it.state = "done";'
];
const EREOPEN_NULL_GUARD = [
  /const it = item\(ui\.sel\); it\.state = "next";/,
  'const it = item(ui.sel);\n' +
  '  /* #eReopen も同様。 */\n' +
  '  if(!it) return;\n' +
  '  it.state = "next";'
];
const PSAVE_NULL_GUARD = [
  /const p = prj\(ui\.sel\);/,
  'const p = prj(ui.sel);\n' +
  '  /* #pSave はプロジェクト編集パネル表示中しか存在しないが、ui.sel が\n' +
  '     外れた状態で呼ばれても例外を投げないようにしておく。 */\n' +
  '  if(!p) return;'
];
const PDONE_NULL_GUARD = [
  /const p = prj\(ui\.sel\); p\.status = "done";/,
  'const p = prj(ui.sel);\n' +
  '  /* #pDone も同様。 */\n' +
  '  if(!p) return;\n' +
  '  p.status = "done";'
];

const CASES = [
  { name: "[data-open] → openSettings()",
    oldAnchor: "if(open){", newFn: "openSettings", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_TO_ALL_PANEL] },

  { name: "[data-cmove] → moveContext(ix, d)",
    oldAnchor: "if(cmove){", newFn: "moveContext", newSrc: actionsSrc,
    subs: [
      [/const ix = \+cmove\.dataset\.cmove, d = \+cmove\.dataset\.dir, to = ix \+ d;/, "const to = ix + d;"],
      [/save\(\); renderRail\(\); renderPanel\(\);/, "save(); renderAll();"]
    ] },

  { name: "[data-cdel] → deleteContext(ix)",
    oldAnchor: "if(cdel){", newFn: "deleteContext", newSrc: actionsSrc,
    subs: [[/const ix = \+cdel\.dataset\.cdel, name = db\.contexts\[ix\], n = ctxUse\(name\);/,
             "const name = db.contexts[ix], n = ctxUse(name);"]] },

  { name: '#appSave → saveAppName(name, tag)',
    oldAnchor: 'if(t.id==="appSave"){', newFn: "saveAppName", newSrc: actionsSrc,
    subs: [
      [/const n = \$\("#appName"\)\.value\.trim\(\);\s*\n\s*if\(!n\)/, "if(!name)"],
      [/db\.appName = n; db\.appTag = \$\("#appTag"\)\.value\.trim\(\);/, "db.appName = name; db.appTag = tag;"],
      [/save\(\); renderRail\(\);/, "save(); renderAll();"]
    ] },

  { name: "[data-tpledit] → openTemplateEditor(id)",
    oldAnchor: "if(tedit){", newFn: "openTemplateEditor", newSrc: actionsSrc,
    subs: [
      [/e\.stopPropagation\(\);\s*\n\s*/, ""],
      [/db\.templates\.find\(x => x\.id===tedit\.dataset\.tpledit\)/, "db.templates.find(x => x.id===id)"],
      RENDER_UNIFY_TO_ALL_PANEL
    ] },

  { name: "[data-tplrun] → runTemplate(id)",
    oldAnchor: "if(trun){", newFn: "runTemplate", newSrc: actionsSrc,
    subs: [
      [/db\.templates\.find\(x => x\.id===trun\.dataset\.tplrun\)/, "db.templates.find(x => x.id===id)"],
      [/tplRun\(tp\); save\(\); flash\(tp\.id\); renderRail\(\); renderList\(\);/, "tplRun(tp); save(); flash(tp.id); renderAll();"]
    ] },

  { name: "#tplAllRun → runAllPendingTemplates()",
    oldAnchor: 'if(t.id==="tplAllRun"){', newFn: "runAllPendingTemplates", newSrc: actionsSrc, subs: [] },

  { name: "#tplNew → newTemplate()",
    oldAnchor: 'if(t.id==="tplNew"){', newFn: "newTemplate", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_TO_ALL_PANEL] },

  { name: "[data-wd] → toggleTemplateWeekday(ix)",
    oldAnchor: "if(wd){", newFn: "toggleTemplateWeekday", newSrc: actionsSrc,
    subs: [
      [/const ix = \+wd\.dataset\.wd, a = ui\.tplDraft\.weekdays \|\| \(ui\.tplDraft\.weekdays = \[\]\);/,
             "const a = ui.tplDraft.weekdays || (ui.tplDraft.weekdays = []);"],
      RENDER_UNIFY_TO_ALL_PANEL
    ] },

  { name: '#tSave / #tSaveRun → saveTemplate({run})',
    oldAnchor: 'if(t.id==="tSave" || t.id==="tSaveRun"){', newFn: "saveTemplate", newSrc: actionsSrc,
    subs: [[/if\(t\.id==="tSaveRun"\)/, "if(run)"]] },

  { name: "#tDel → deleteTemplate()",
    oldAnchor: 'if(t.id==="tDel"){', newFn: "deleteTemplate", newSrc: actionsSrc, subs: [] },

  { name: "#eTpl → makeTemplateFromItem(id)",
    oldAnchor: 'if(t.id==="eTpl"){', newFn: "makeTemplateFromItem", newSrc: actionsSrc,
    subs: [
      [/const it = item\(ui\.sel\);/, "const it = item(id);"],
      ETPL_NULL_GUARD,
      RENDER_UNIFY_TO_ALL_PANEL
    ] },

  { name: "[data-view] → switchView(view)",
    oldAnchor: "if(nav){", newFn: "switchView", newSrc: actionsSrc,
    subs: [[/ui\.view = nav\.dataset\.view;/, "ui.view = view;"]] },

  { name: "[data-tick] → toggleItemDone(id)",
    oldAnchor: "if(tick){", newFn: "toggleItemDone", newSrc: actionsSrc,
    subs: [
      [/e\.stopPropagation\(\);\s*\n\s*/, ""],
      [/const it = item\(tick\.dataset\.tick\);/, "const it = item(id);"]
    ] },

  { name: "[data-id] → selectItem(id)",
    oldAnchor: "if(row){", newFn: "selectItem", newSrc: actionsSrc,
    subs: [
      [/const it = item\(row\.dataset\.id\);/, "const it = item(id);"],
      RENDER_UNIFY_LIST_PANEL
    ] },

  { name: "[data-prj] → selectProject(id)",
    oldAnchor: "if(pc){", newFn: "selectProject", newSrc: actionsSrc,
    subs: [
      [/ui\.sel = pc\.dataset\.prj;/, "ui.sel = id;"],
      RENDER_UNIFY_TO_ALL_PANEL
    ] },

  { name: "[data-min] → setMinutesFilter(n)",
    oldAnchor: "if(chipM){", newFn: "setMinutesFilter", newSrc: actionsSrc,
    subs: [
      [/ui\.min = \+chipM\.dataset\.min;/, "ui.min = n;"],
      RENDER_UNIFY_FILTERS_LIST
    ] },

  { name: "[data-energy] → setEnergyFilter(v)",
    oldAnchor: "if(chipE){", newFn: "setEnergyFilter", newSrc: actionsSrc,
    subs: [
      [/ui\.energy = chipE\.dataset\.energy;/, "ui.energy = v;"],
      RENDER_UNIFY_FILTERS_LIST
    ] },

  { name: "[data-opt] → chooseClarifyOption(index)",
    oldAnchor: "if(opt){", newFn: "chooseClarifyOption", newSrc: actionsSrc,
    subs: [[/clarChoose\(\+opt\.dataset\.opt\);/, "clarChoose(index);"]] },

  { name: "#fSave → submitClarify()",
    oldAnchor: 'if(t.id==="fSave"){', newFn: "submitClarify", newSrc: actionsSrc, subs: [] },
  { name: "#fBack → backClarify()",
    oldAnchor: 'if(t.id==="fBack"){', newFn: "backClarify", newSrc: actionsSrc,
    subs: [FBACK_NULL_GUARD, RENDER_UNIFY_TO_ALL_PANEL] },
  { name: "#clarRestart → restartClarify()",
    oldAnchor: 'if(t.id==="clarRestart"){', newFn: "restartClarify", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_TO_ALL_PANEL] },
  { name: "#clarEdit → cancelClarify()",
    oldAnchor: 'if(t.id==="clarEdit"){', newFn: "cancelClarify", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_TO_ALL_PANEL] },
  { name: "#eClar → startClarify()",
    oldAnchor: 'if(t.id==="eClar"){', newFn: "startClarify", newSrc: actionsSrc, subs: [] },

  { name: "#pClose → closePanelView()  ※命名変更あり（下記参照）",
    oldAnchor: 'if(t.id==="pClose"){', newFn: "closePanelView", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_CLOSE_LIST] },

  { name: "#eSave → saveItemEdit()",
    oldAnchor: 'if(t.id==="eSave"){', newFn: "saveItemEdit", newSrc: actionsSrc,
    subs: [ESAVE_NULL_GUARD] },
  { name: "#eDone → completeItem()",
    oldAnchor: 'if(t.id==="eDone"){', newFn: "completeItem", newSrc: actionsSrc,
    subs: [EDONE_NULL_GUARD] },
  { name: "#eReopen → reopenItem()",
    oldAnchor: 'if(t.id==="eReopen"){', newFn: "reopenItem", newSrc: actionsSrc,
    subs: [EREOPEN_NULL_GUARD] },
  { name: "#eDel → deleteItem()",
    oldAnchor: 'if(t.id==="eDel"){', newFn: "deleteItem", newSrc: actionsSrc, subs: [] },

  { name: "#pSave → saveProject()",
    oldAnchor: 'if(t.id==="pSave"){', newFn: "saveProject", newSrc: actionsSrc,
    subs: [PSAVE_NULL_GUARD] },
  { name: "#pDone → completeProject()",
    oldAnchor: 'if(t.id==="pDone"){', newFn: "completeProject", newSrc: actionsSrc,
    subs: [PDONE_NULL_GUARD] },
  { name: "#pDel → deleteProject()",
    oldAnchor: 'if(t.id==="pDel"){', newFn: "deleteProject", newSrc: actionsSrc, subs: [] },

  { name: "#btnImport → promptImport()",
    oldAnchor: 'if(t.id==="btnImport"){', newFn: "promptImport", newSrc: actionsSrc, subs: [] },

  { name: '[data-rv] "jump" → reviewJump()',
    oldAnchor: 'else if(a==="jump"){', newFn: "reviewJump", newSrc: actionsSrc,
    subs: [[/^\s*ui\.view = REVIEW\[ui\.review\]\.jump; ui\.review = null; renderAll\(\);\s*$/,
             "ui.view = REVIEW[ui.review].jump; ui.review = null; renderAll();\n  renderReview();"]] },

  { name: '[data-rv] "finish" → reviewFinish()',
    oldAnchor: 'else if(a==="finish"){', newFn: "reviewFinish", newSrc: actionsSrc,
    subs: [[/ui\.review = null; save\(\); renderAll\(\);\s*$/,
             "ui.review = null; save(); renderAll();\n  renderReview();"]] },

  { name: "[data-rvopen] → openFromReview(id, isProject)",
    oldAnchor: "if(rvo){", newFn: "openFromReview", newSrc: actionsSrc,
    subs: [
      [/ui\.sel = rvo\.dataset\.rvopen;/, "ui.sel = id;"],
      [/ui\.view = rvo\.dataset\.rvp==="1" \? "projects"/, 'ui.view = isProject ? "projects"']
    ] },

  /* ---- input / change×2 / keydown ---- */
  { name: "input #qIn → setSearchQuery(v)",
    oldAnchor: 'if(e.target.id==="qIn"){', newFn: "setSearchQuery", newSrc: actionsSrc,
    subs: [[/ui\.q = e\.target\.value;/, "ui.q = v;"]] },

  { name: "change #tCycle → changeTemplateCycle()",
    oldAnchor: 'if(e.target.id==="tCycle" && ui.tplDraft){', newFn: "changeTemplateCycle", newSrc: actionsSrc, subs: [] },

  { name: "keydown #ctxNew Enter → addContextNew(el)",
    oldAnchor: 'if(e.target.id==="ctxNew" && e.key==="Enter"){', newFn: "addContextNew", newSrc: actionsSrc,
    subs: [
      [/const v = e\.target\.value\.trim\(\); if\(!v\) return;/, "const v = el.value.trim(); if(!v) return;"],
      [/db\.contexts\.push\(v\); e\.target\.value = "";/, 'db.contexts.push(v); el.value = "";']
    ] },

  { name: "keydown #pAdd Enter → addProjectAction(el)",
    oldAnchor: 'if(e.target.id==="pAdd" && e.key==="Enter"){', newFn: "addProjectAction", newSrc: actionsSrc,
    subs: [[/const v = e\.target\.value\.trim\(\); if\(!v\) return;/, "const v = el.value.trim(); if(!v) return;"],
           PADD_REFOCUS] },

  { name: "keydown Escape → dismissActive()",
    oldAnchor: 'if(e.key==="Escape"){', newFn: "dismissActive", newSrc: actionsSrc,
    subs: [RENDER_UNIFY_CLOSE_LIST] },

  { name: '[data-rv] "close" → reviewClose()',
    oldAnchor: 'else if(a==="close"){', newFn: "reviewClose", newSrc: actionsSrc,
    subs: [[/ui\.review = null;\s*$/, "ui.review = null;\n  renderReview();"]] },

  { name: "overlay背景クリック → closeReviewOverlay()  ※対応表に無い分岐（下記参照）",
    oldAnchor: "if(t.dataset && t.dataset.ovbg){", newFn: "closeReviewOverlay", newSrc: actionsSrc, subs: [] },

  { name: "keydown [data-tplrun]カード Enter/Space → triggerTemplateCardClick(e, card)",
    oldAnchor: 'if(card && (e.key==="Enter" || e.key===" ")){', newFn: "triggerTemplateCardClick", newSrc: actionsSrc, subs: [] },

  { name: 'keydown "n" → focusCapture(e)',
    oldAnchor: 'if(!typing && e.key==="n"){', newFn: "focusCapture", newSrc: actionsSrc, subs: [] },

  { name: 'keydown "/" → focusSearch(e)',
    oldAnchor: 'if(!typing && e.key==="/"){', newFn: "focusSearch", newSrc: actionsSrc, subs: [] }
];

/* reviewNext / reviewPrev は旧コードでは波括弧を持たない単文
   （`if(a==="next") ui.review++;` / `else if(a==="prev") ui.review--;`）
   なので、専用の抽出（次の ";" までを取り出す）で比較する。 */
function extractSingleStatement(text, anchor){
  const at = text.indexOf(anchor);
  if(at < 0) throw new Error(`anchor not found: ${JSON.stringify(anchor)}`);
  const start = at + anchor.length;
  const end = text.indexOf(";", start);
  if(end < 0) throw new Error(`no ";" after anchor: ${JSON.stringify(anchor)}`);
  return text.slice(start, end + 1);
}

test('equivalence: [data-rv] "next" → reviewNext()', () => {
  const rawOld = extractSingleStatement(oldSrc, 'if(a==="next") ');
  const expected = norm(rawOld + " renderReview();");
  const newBody = norm(extractFunctionBody(actionsSrc, "reviewNext"));
  assert.equal(newBody, expected);
});
test('equivalence: [data-rv] "prev" → reviewPrev()', () => {
  const rawOld = extractSingleStatement(oldSrc, 'else if(a==="prev") ');
  const expected = norm(rawOld + " renderReview();");
  const newBody = norm(extractFunctionBody(actionsSrc, "reviewPrev"));
  assert.equal(newBody, expected);
});

/* change #2（コンテキスト改名）は旧コードでは
   「!el.classList || !classList.contains('ctx-in') なら return」という
   マッチ判定（＝ルーティング表側の match() に移した部分）がハンドラ本体の
   先頭にあり、その後ろが renameContext() の中身にあたる。
   match() 相当のガード行を除いた残りが一致することを確認する。 */
test("equivalence: change ctx-in → renameContext(el, ix)", () => {
  const anchor = 'if(!el.classList || !el.classList.contains("ctx-in")) return;';
  const full = extractBraceBlock(oldSrc, 'guard("コンテキスト編集", e => {', 0);
  const guardEnd = full.indexOf(anchor) + anchor.length;
  const rest = full.slice(guardEnd);
  const rawOldAfterSubs = applySubs(rest, [
    [/const ix = \+el\.dataset\.cix, before = db\.contexts\[ix\], after = el\.value\.trim\(\);/,
      "const before = db.contexts[ix], after = el.value.trim();"]
  ]);
  const expected = norm(rawOldAfterSubs);
  const newBody = norm(extractFunctionBody(actionsSrc, "renameContext"));
  assert.equal(newBody, expected);
});

/* 旧コードは各分岐の最後に、外側の click/keydown 委譲ハンドラを抜けるための
   `return;`（＝「これ以上他の分岐を試さない」という委譲側の制御フローであり、
   分岐自身のロジックではない）を置いていた。分岐を独立関数として切り出すと
   関数の末尾に達すること自体が return を意味するため、この「委譲側の
   return」だけは両者で対応が取れないのが自然であり、全ケースに機械的に
   現れる差分である。よって「文字列の最末尾に現れる、それ単体の `return;`」
   のみを比較対象から除外する（途中にある早期リターンの `return;` は
   文字列の末尾ではないため、この正規表現の対象にならず、除外されない）。 */
function stripTrailingDelegateReturn(s){
  return s.replace(/\breturn;\s*$/, "");
}

for(const c of CASES){
  test(`equivalence: ${c.name}`, () => {
    const rawOld = extractBraceBlock(oldSrc, c.oldAnchor);
    const rawOldAfterSubs = applySubs(rawOld, c.subs);
    const rawOldFinal = c.keepTrailingReturn ? rawOldAfterSubs : stripTrailingDelegateReturn(rawOldAfterSubs);
    const expected = norm(rawOldFinal);
    const newBody = norm(extractFunctionBody(c.newSrc, c.newFn));
    assert.equal(newBody, expected,
      `\n---old(after subs, raw)---\n${rawOldFinal}\n---expected(normalized)---\n${expected}\n---new(normalized)---\n${newBody}\n`);
  });
}

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) module.exports = {};
