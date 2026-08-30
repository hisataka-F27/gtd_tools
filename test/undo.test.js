"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { pushUndo, popUndo, undoDepth, resetUndo, getDb, setDb } = app;

test("pushUndo: 積むたびに undoDepth() が増える", () => {
  resetUndo();
  assert.equal(undoDepth(), 0);
  setDb({items:[], marker:"a"});
  pushUndo("a");
  assert.equal(undoDepth(), 1);
  setDb({items:[], marker:"b"});
  pushUndo("b");
  assert.equal(undoDepth(), 2);
});

test("11回積むと深さが10で止まり、最も古いものが落ちている", () => {
  resetUndo();
  for(let i = 1; i <= 11; i++){
    setDb({items:[], marker:"m" + i});
    pushUndo("label" + i);
  }
  assert.equal(undoDepth(), 10);
  const seen = [];
  for(let i = 0; i < 10; i++){
    seen.push(popUndo().marker);
  }
  assert.deepEqual(seen, ["m11","m10","m9","m8","m7","m6","m5","m4","m3","m2"]);
  assert.equal(popUndo(), null);
});

test("popUndo() が積んだ時点の db を返し、以後の変更に影響されない（＝深いコピーである）", () => {
  resetUndo();
  const original = {items:[{id:"x", title:"orig"}]};
  setDb(original);
  pushUndo("edit");
  original.items[0].title = "changed後から書き換え";
  const restored = popUndo();
  assert.equal(restored.items[0].title, "orig");
});

test("空のときの popUndo() は null", () => {
  resetUndo();
  assert.equal(popUndo(), null);
});
