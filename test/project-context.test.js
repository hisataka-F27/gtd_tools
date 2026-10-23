"use strict";
/* =========================================================
   test/project-context.test.js
   #15 プロジェクトの既定コンテキスト（PLAN-2026-10.md）
   addProjectAction は DOM（renderPanel 等）に触るため、
   他のアクション系テストと同じく withDom() のスタブ越しに呼ぶ。
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, withDom } = require("./helpers/load-app.js");

const app = loadApp();
const { blank, setDb, getDb, getUi, addProjectAction } = app;

function addWith(context){
  const d = Object.assign(blank(), {
    projects: [{id:"p1", name:"P", outcome:"", context, status:"active", created:"2026-01-01"}]
  });
  setDb(d);
  getUi().sel = "p1";
  withDom(() => addProjectAction({value: "資料を作る"}));
  return getDb().items[0];
}

test("addProjectAction: プロジェクトの context が行動の初期値になる", () => {
  const a = addWith("@PC");
  assert.equal(a.context, "@PC");
  assert.equal(a.project, "p1");
  assert.equal(a.state, "next");
});

test("addProjectAction: context が \"\" なら従来どおり \"\" のまま", () => {
  assert.equal(addWith("").context, "");
});
