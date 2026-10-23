"use strict";
/* =========================================================
   test/today-order.test.js
   #13 「今日やる」の並び順（PLAN-2026-10.md）
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, withDom } = require("./helpers/load-app.js");

const app = loadApp();
const {
  reorderIds, dropBeforeId, listGroups, reorderToday, moveTodayItem, toggleTodayFlag,
  setDb, getDb, getUi, setUi, blank, today
} = app;

function mk(id, overrides){
  return Object.assign({
    id, title: id, note: "", state: "next", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: "2026-01-01", updated: today(), doneAt: null, flagged: today(), todayOrder: 0
  }, overrides);
}
function setItems(items){
  setDb(Object.assign(blank(), {items}));
  getUi().view = "today";
  getUi().q = "";
}
const todayIds = () => listGroups("today")[0].items.map(i => i.id);

/* ---- reorderIds ---- */

test("reorderIds: 先頭を末尾へ（beforeId が null）", () => {
  assert.deepEqual(reorderIds(["a","b","c"], "a", null), ["b","c","a"]);
});
test("reorderIds: 末尾を先頭へ", () => {
  assert.deepEqual(reorderIds(["a","b","c"], "c", "a"), ["c","a","b"]);
});
test("reorderIds: 隣同士の入れ替え", () => {
  assert.deepEqual(reorderIds(["a","b","c"], "b", "a"), ["b","a","c"]);
  assert.deepEqual(reorderIds(["a","b","c"], "a", "c"), ["b","a","c"]);
});
test("reorderIds: 配列に無い id / dragId===beforeId / 無い beforeId は内容そのまま", () => {
  assert.deepEqual(reorderIds(["a","b"], "x", "a"), ["a","b"]);
  assert.deepEqual(reorderIds(["a","b"], "a", "a"), ["a","b"]);
  assert.deepEqual(reorderIds(["a","b"], "a", "zz"), ["a","b"]);
});
test("reorderIds: 元の配列を破壊しない", () => {
  const ids = ["a","b","c"];
  const out = reorderIds(ids, "c", "a");
  assert.deepEqual(ids, ["a","b","c"]);
  assert.notEqual(out, ids);
});

/* ---- dropBeforeId ---- */

test("dropBeforeId: 上半分はその行の前、下半分は次の行の前、最後の行の下半分は null", () => {
  const ids = ["a","b","c"];
  assert.equal(dropBeforeId(ids, "b", false), "b");
  assert.equal(dropBeforeId(ids, "b", true), "c");
  assert.equal(dropBeforeId(ids, "c", true), null);
  assert.equal(dropBeforeId(ids, "zz", true), undefined);
});

/* ---- listGroups("today") の順序 ---- */

test("listGroups(today): todayOrder の昇順に出る", () => {
  setItems([mk("a",{todayOrder:3}), mk("b",{todayOrder:1}), mk("c",{todayOrder:2})]);
  assert.deepEqual(todayIds(), ["b","c","a"]);
});
test("listGroups(today): todayOrder 0 は値を持つ項目より後ろ", () => {
  setItems([mk("a",{todayOrder:0, created:"2025-01-01"}), mk("b",{todayOrder:2}), mk("c",{todayOrder:1})]);
  assert.deepEqual(todayIds(), ["c","b","a"]);
});
test("listGroups(today): 0 同士は created 昇順", () => {
  setItems([mk("a",{created:"2026-03-01"}), mk("b",{created:"2026-01-01"}), mk("c",{created:"2026-02-01"})]);
  assert.deepEqual(todayIds(), ["b","c","a"]);
});

/* ---- reorderToday / moveTodayItem ---- */

test("reorderToday: 振り直しは 1 から連番で、今日やるに出ていない項目は触らない", () => {
  setItems([
    mk("a"), mk("b"), mk("c"),
    mk("off", {flagged: null, todayOrder: 7}),
    mk("old", {flagged: "2020-01-01", todayOrder: 9}),
    mk("inbox", {state: "inbox", todayOrder: 5})
  ]);
  withDom(() => reorderToday("c", "a"));
  const d = getDb();
  const o = id => d.items.find(i => i.id===id).todayOrder;
  assert.deepEqual(todayIds(), ["c","a","b"]);
  assert.equal(o("c"), 1); assert.equal(o("a"), 2); assert.equal(o("b"), 3);
  assert.equal(o("off"), 7); assert.equal(o("old"), 9); assert.equal(o("inbox"), 5);
});
test("reorderToday: 変化が無ければ書き換えない", () => {
  setItems([mk("a"), mk("b")]);
  withDom(() => reorderToday("a", "b")); /* a は既に b の前 */
  assert.equal(getDb().items[0].todayOrder, 0);
});
test("reorderToday: 検索中は並べ替えない", () => {
  setItems([mk("a"), mk("b")]);
  getUi().q = "a";
  withDom(() => reorderToday("b", "a"));
  assert.equal(getDb().items[1].todayOrder, 0);
});
test("moveTodayItem: ↑↓ で隣と入れ替わり、先頭の ↑・末尾の ↓ は何もしない", () => {
  setItems([mk("a"), mk("b"), mk("c")]);
  withDom(() => moveTodayItem("a", -1));
  withDom(() => moveTodayItem("c", 1));
  assert.deepEqual(todayIds(), ["a","b","c"]);
  withDom(() => moveTodayItem("a", 1));
  assert.deepEqual(todayIds(), ["b","a","c"]);
  withDom(() => moveTodayItem("c", -1));
  assert.deepEqual(todayIds(), ["b","c","a"]);
});
test("toggleTodayFlag: 外して付け直した項目は末尾に付く", () => {
  setItems([mk("a",{todayOrder:1}), mk("b",{todayOrder:2}), mk("c",{todayOrder:3})]);
  withDom(() => toggleTodayFlag("a"));
  withDom(() => toggleTodayFlag("a"));
  assert.deepEqual(todayIds(), ["b","c","a"]);
});
