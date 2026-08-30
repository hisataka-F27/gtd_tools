"use strict";
/* =========================================================
   test/today-flag.test.js
   #6 「今日やる」印（PLAN-P1.md ステップA）
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const {
  isToday, listGroups, normalize, setDb, getDb, blank, today, MODEL_VERSION, MIGRATIONS
} = app;

function daysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function baseItem(overrides){
  return Object.assign({
    id: "i1", title: "行動", note: "", state: "next", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: today(), updated: today(), doneAt: null, flagged: null
  }, overrides);
}

function setDbWith(overrides){
  const db = Object.assign(blank(), overrides);
  setDb(db);
  return db;
}

/* ---- isToday ---- */

test("isToday: state=next かつ flagged が今日なら true", () => {
  const it = baseItem({state: "next", flagged: today()});
  assert.equal(isToday(it), true);
});

test("isToday: flagged が昨日なら false", () => {
  const it = baseItem({state: "next", flagged: daysAgo(1)});
  assert.equal(isToday(it), false);
});

test("isToday: flagged が null なら false", () => {
  const it = baseItem({state: "next", flagged: null});
  assert.equal(isToday(it), false);
});

test("isToday: flagged は今日でも state が next 以外なら false", () => {
  ["inbox", "waiting", "calendar", "someday", "reference", "done"].forEach(state => {
    const it = baseItem({state, flagged: today()});
    assert.equal(isToday(it), false, `state=${state} で true になってしまった`);
  });
});

/* ---- マイグレーション（旧データ互換） ---- */

test("マイグレーション: version:1 で flagged を持たない items は normalize() で flagged:null が入る", () => {
  setDbWith({
    version: 1,
    items: [
      {id:"old1", title:"旧項目1", state:"next", note:"", context:"", project:null, due:null,
       who:"", since:null, minutes:0, energy:"", created:"2026-01-01", updated:"2026-01-01", doneAt:null},
      {id:"old2", title:"旧項目2", state:"done", note:"", context:"", project:null, due:null,
       who:"", since:null, minutes:0, energy:"", created:"2026-01-01", updated:"2026-01-01", doneAt:"2026-01-02"}
    ]
  });
  assert.doesNotThrow(() => normalize());
  const db = getDb();
  assert.equal(db.version, MODEL_VERSION);
  assert.equal(db.items.length, 2);
  db.items.forEach(i => assert.equal(i.flagged, null));
  // 既存フィールドは壊れない
  assert.equal(db.items[0].title, "旧項目1");
  assert.equal(db.items[1].doneAt, "2026-01-02");
});

test("マイグレーション: version フィールドを持たない旧データ（リファクタ前の形）でも例外なく flagged:null が入る", () => {
  // version キー自体が無い＝0扱い。MIGRATIONS[1]・[2] の両方が順に走る。
  const db0 = setDbWith({
    items: [
      {id:"veryold", title:"かなり古い項目", state:"waiting", who:"誰か", since:"2026-01-01"}
    ]
  });
  // blank() 由来の version をここで明示的に消し、「version フィールド自体が無い旧データ」を再現する
  delete db0.version;
  delete db0.contexts; delete db0.projects; delete db0.review;
  delete db0.templates; delete db0.appName; delete db0.appTag;
  assert.doesNotThrow(() => normalize());
  const db = getDb();
  assert.equal(db.version, MODEL_VERSION);
  assert.equal(db.items.length, 1);
  assert.equal(db.items[0].flagged, null);
  // 既存フィールドは壊れない
  assert.equal(db.items[0].title, "かなり古い項目");
  assert.equal(db.items[0].who, "誰か");
  // MIGRATIONS[1] 由来の欠損補完も同時に効いている
  assert.deepEqual(db.contexts, blank().contexts);
  assert.deepEqual(db.projects, []);
});

test("マイグレーション: 既に flagged を持つ項目の値は書き換えない", () => {
  setDbWith({
    version: 1,
    items: [
      {id:"i1", title:"印付き", state:"next", flagged:"2026-01-01", note:"", context:"",
       project:null, due:null, who:"", since:null, minutes:0, energy:"",
       created:"2026-01-01", updated:"2026-01-01", doneAt:null}
    ]
  });
  normalize();
  const db = getDb();
  assert.equal(db.items[0].flagged, "2026-01-01");
});

/* ---- listGroups("today") ---- */

test('listGroups("today"): 印の付いた項目だけを created 昇順で返す', () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"next", flagged: today(), created:"2026-08-20"}),
      baseItem({id:"b", state:"next", flagged: null, created:"2026-08-10"}),
      baseItem({id:"c", state:"next", flagged: today(), created:"2026-08-05"}),
      baseItem({id:"d", state:"someday", flagged: today(), created:"2026-08-01"}),
      baseItem({id:"e", state:"next", flagged: daysAgo(1), created:"2026-08-02"})
    ]
  });
  const groups = listGroups("today");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, null);
  assert.deepEqual(groups[0].items.map(i => i.id), ["c", "a"]);
});

test('listGroups("today"): 印が1件も無ければ空グループ', () => {
  setDbWith({
    items: [baseItem({id:"a", state:"next", flagged: null})]
  });
  const groups = listGroups("today");
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].items, []);
});
