"use strict";
/* =========================================================
   test/review-act.test.js
   #12 レビュー行内の処理（PLAN-P1.md ステップB）
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { REVIEW, applyReviewAct, today } = app;

function baseItem(overrides){
  return Object.assign({
    id: "i1", title: "行動", note: "", state: "next", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: today(), updated: today(), doneAt: null, flagged: null
  }, overrides);
}

function daysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/* ---- applyReviewAct ---- */

test("applyReviewAct: done は state=done / doneAt=today / updated=today にする", () => {
  const it = baseItem({state: "next", doneAt: null, updated: daysAgo(3)});
  applyReviewAct(it, "done");
  assert.equal(it.state, "done");
  assert.equal(it.doneAt, today());
  assert.equal(it.updated, today());
});

test("applyReviewAct: someday は state=someday / updated=today にする", () => {
  const it = baseItem({state: "next", updated: daysAgo(3)});
  applyReviewAct(it, "someday");
  assert.equal(it.state, "someday");
  assert.equal(it.updated, today());
});

test("applyReviewAct: next は state=next / updated=today にする", () => {
  const it = baseItem({state: "waiting", updated: daysAgo(3)});
  applyReviewAct(it, "next");
  assert.equal(it.state, "next");
  assert.equal(it.updated, today());
});

test("applyReviewAct: today は state=next にしたうえで flagged=today にする", () => {
  const it = baseItem({state: "someday", flagged: null});
  applyReviewAct(it, "today");
  assert.equal(it.state, "next");
  assert.equal(it.flagged, today());
});

test("applyReviewAct: today は元々 next の項目にも適用できる（flagged が立つ）", () => {
  const it = baseItem({state: "next", flagged: null, updated: daysAgo(20)});
  applyReviewAct(it, "today");
  assert.equal(it.state, "next");
  assert.equal(it.flagged, today());
  /* 停滞（staleNext）は updated からの経過日数で拾うため、その場で今日やると
     決めたものが翌週も停滞として並び続けないよう updated も進める。 */
  assert.equal(it.updated, today());
});

test("applyReviewAct: 引数の item を書き換えて返すだけで、他の状態は変えない", () => {
  const it = baseItem({state: "next", context: "@pc", minutes: 30});
  applyReviewAct(it, "done");
  assert.equal(it.context, "@pc");
  assert.equal(it.minutes, 30);
});

/* ---- REVIEW の acts 割り当て（節の順序・内容とも固定する） ---- */

test("REVIEW: 各節の acts が計画表のとおりである", () => {
  const expected = [
    {t: "収集トレイを空にする", acts: ["done"]},
    {t: "期限切れを拾う", acts: ["done", "someday"]},
    {t: "待ちを督促する", acts: ["done", "next"]},
    {t: "止まっているプロジェクトを動かす", acts: undefined},
    {t: "停滞したアクションを見直す", acts: ["done", "someday", "today"]},
    {t: "いつかリストを棚卸しする", acts: ["done", "next", "today"]}
  ];
  assert.equal(REVIEW.length, expected.length);
  REVIEW.forEach((section, ix) => {
    assert.equal(section.t, expected[ix].t, `節${ix}のタイトルが一致しない`);
    assert.deepEqual(section.acts, expected[ix].acts, `節「${section.t}」の acts が一致しない`);
  });
});

test("REVIEW: プロジェクトの節（getP を持つ節）には acts が無い", () => {
  const projectSection = REVIEW.find(s => s.getP);
  assert.ok(projectSection, "getP を持つ節が見つからない");
  assert.equal(projectSection.acts, undefined);
});
