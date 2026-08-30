"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { moveCursor, listGroups, setDb, setUi, blank, today } = app;

test("moveCursor: null から +1 で先頭", () => {
  assert.equal(moveCursor(["a","b","c"], null, 1), "a");
});
test("moveCursor: 末尾で +1 は動かない（巻き戻さない）", () => {
  assert.equal(moveCursor(["a","b","c"], "c", 1), "c");
});
test("moveCursor: 先頭で -1 は動かない（巻き戻さない）", () => {
  assert.equal(moveCursor(["a","b","c"], "a", -1), "a");
});
test("moveCursor: cur が配列に無い id のときは先頭", () => {
  assert.equal(moveCursor(["a","b","c"], "zzz", 1), "a");
  assert.equal(moveCursor(["a","b","c"], "zzz", -1), "a");
});
test("moveCursor: 空配列のときは null", () => {
  assert.equal(moveCursor([], null, 1), null);
  assert.equal(moveCursor([], "a", -1), null);
});
test("moveCursor: 中間から前後に動く", () => {
  assert.equal(moveCursor(["a","b","c"], "b", 1), "c");
  assert.equal(moveCursor(["a","b","c"], "b", -1), "a");
});

function baseItem(overrides){
  return Object.assign({
    id: "i1", title: "行動", note: "", state: "next", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: today(), updated: today(), doneAt: null
  }, overrides);
}

test("listGroups: 「次のアクション」ではコンテキスト名の昇順にグループが並び、flat にした id 順が画面順と一致する", () => {
  const db = Object.assign(blank(), {
    items: [
      baseItem({id:"z1", state:"next", context:"@zoo", created:"2026-01-01"}),
      baseItem({id:"a1", state:"next", context:"@apple", created:"2026-01-02"}),
      baseItem({id:"a2", state:"next", context:"@apple", created:"2026-01-01"}),
      baseItem({id:"n1", state:"next", context:"", created:"2026-01-01"}),
      baseItem({id:"x1", state:"inbox", context:"@apple", created:"2026-01-01"})
    ]
  });
  setDb(db);
  setUi({view:"next", sel:null, cur:null, clar:null, ctx:null, min:0, energy:"", q:"",
    review:null, storeOK:true, tplDraft:null, flash:null});

  const groups = listGroups("next");
  const labels = groups.map(g => g.label);
  assert.deepEqual(labels, ["@apple", "@zoo", "（コンテキスト未設定）"]);

  const flatIds = groups.flatMap(g => g.items.map(i => i.id));
  assert.deepEqual(flatIds, ["a2", "a1", "z1", "n1"]);
});

test("listGroups: グループ内の順序も created 昇順（renderList と同じ並べ替え規則）", () => {
  const db = Object.assign(blank(), {
    items: [
      baseItem({id:"later", state:"next", context:"@x", created:"2026-01-05"}),
      baseItem({id:"earlier", state:"next", context:"@x", created:"2026-01-01"})
    ]
  });
  setDb(db);
  setUi({view:"next", sel:null, cur:null, clar:null, ctx:null, min:0, energy:"", q:"",
    review:null, storeOK:true, tplDraft:null, flash:null});

  const groups = listGroups("next");
  assert.deepEqual(groups[0].items.map(i => i.id), ["earlier", "later"]);
});
