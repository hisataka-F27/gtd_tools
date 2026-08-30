"use strict";
/* =========================================================
   test/archive.test.js
   #8 完了項目のアーカイブ（PLAN-P2.md ステップC）
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, withDom } = require("./helpers/load-app.js");

const app = loadApp();
const {
  oldDone, recentDone, ARCHIVE_DAYS, listGroups, setDb, setUi, getUi, blank, today
} = app;

/* daysSince() と同じく today() を new Date() に直接渡して比較するため、
   ここでの日付計算も UTC で揃える（export-reminder.test.js と同じ方針）。 */
function daysAgoStr(n){
  const d = new Date(today() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function baseItem(overrides){
  return Object.assign({
    id: "i1", title: "行動", note: "", state: "done", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: today(), updated: today(), doneAt: null, flagged: null
  }, overrides);
}

/* ---- oldDone() / recentDone() ---- */

test("oldDone: 91日前に完了した項目は対象", () => {
  const it = baseItem({doneAt: daysAgoStr(91)});
  assert.equal(oldDone(it), true);
  assert.equal(recentDone(it), false);
});

test("oldDone: ちょうど90日前（境界）も対象", () => {
  const it = baseItem({doneAt: daysAgoStr(ARCHIVE_DAYS)});
  assert.equal(oldDone(it), true);
});

test("oldDone: 89日前に完了した項目は対象外", () => {
  const it = baseItem({doneAt: daysAgoStr(89)});
  assert.equal(oldDone(it), false);
  assert.equal(recentDone(it), true);
});

test("oldDone: doneAt が無い完了項目は対象外（安全側）", () => {
  const it = baseItem({doneAt: null});
  assert.equal(oldDone(it), false);
  assert.equal(recentDone(it), true);
});

test("oldDone: 完了していない項目（state!==done）は対象外", () => {
  const it = baseItem({state: "next", doneAt: daysAgoStr(200)});
  assert.equal(oldDone(it), false);
});

/* ---- listGroups("done") ---- */

function setupDoneDb(){
  const db = Object.assign(blank(), {
    items: [
      baseItem({id: "old1", doneAt: daysAgoStr(200)}),
      baseItem({id: "old2", doneAt: daysAgoStr(91)}),
      baseItem({id: "recent1", doneAt: daysAgoStr(10)}),
      baseItem({id: "recent2", doneAt: daysAgoStr(1)}),
      baseItem({id: "nodoneat", doneAt: null})
    ]
  });
  setDb(db);
  setUi({view: "done", sel: null, cur: null, clar: null, ctx: null, min: 0, energy: "", q: "",
    review: null, storeOK: true, tplDraft: null, flash: null, doneAll: false});
}

test('listGroups("done"): ui.doneAll=false のとき古い分を含まず、doneAt 降順であること', () => {
  setupDoneDb();
  const groups = listGroups("done");
  const ids = groups.flatMap(g => g.items.map(i => i.id));
  assert.deepEqual(ids, ["recent2", "recent1", "nodoneat"]);
});

test('listGroups("done"): ui.doneAll=true のとき全部含み、doneAt 降順であること', () => {
  setupDoneDb();
  getUi().doneAll = true;
  const groups = listGroups("done");
  const ids = groups.flatMap(g => g.items.map(i => i.id));
  /* doneAt の降順。doneAt が無い（""扱い）項目は最も古い扱いになるため最後。 */
  assert.deepEqual(ids, ["recent2", "recent1", "old2", "old1", "nodoneat"]);
});

/* ---- archiveOldDone(): 「先に書き出す・失敗したら消さない」の確認 ----
   downloadJSON を一時的に例外を投げるものへ差し替え、archiveOldDone() を
   呼んでも db.items が一切減らないことを確認する。 */

test("archiveOldDone: 書き出し（downloadJSON）が例外を投げたら db.items は減らない", () => {
  withDom(() => {
    const { setDb: setDb2, getDb: getDb2, setUi: setUi2, archiveOldDone } = app;
    const db = Object.assign(blank(), {
      items: [
        baseItem({id: "old1", doneAt: daysAgoStr(200)}),
        baseItem({id: "recent1", doneAt: daysAgoStr(1)})
      ]
    });
    setDb2(db);
    setUi2({view: "done", sel: null, cur: null, clar: null, ctx: null, min: 0, energy: "", q: "",
      review: null, storeOK: true, tplDraft: null, flash: null, doneAll: false});

    /* downloadJSON() 自体は src/js/*.js の vm スコープに閉じ込められていて
       テスト側から直接差し替えられない。downloadJSON の内部が呼ぶ
       URL.createObjectURL を（withDom() が差し込んだブラウザスタブ経由で）
       例外を投げるものにすり替えることで、「書き出しに失敗した」状態を
       実際に発生させる（sandbox 環境でダウンロードが塞がれるのと同じ経路）。 */
    const originalCreateObjectURL = global.URL.createObjectURL;
    global.URL.createObjectURL = () => { throw new Error("書き出し失敗（テスト用）"); };
    try{
      assert.doesNotThrow(() => archiveOldDone());
    } finally {
      global.URL.createObjectURL = originalCreateObjectURL;
    }

    const after = getDb2();
    assert.equal(after.items.length, 2, "書き出しに失敗しても db.items は減らないこと");
    assert.ok(after.items.some(i => i.id === "old1"), "古い完了項目もまだ残っていること");
  });
});

test("archiveOldDone: 対象が0件なら何もしない", () => {
  withDom(() => {
    const { setDb: setDb2, getDb: getDb2, archiveOldDone } = app;
    const db = Object.assign(blank(), {
      items: [baseItem({id: "recent1", doneAt: daysAgoStr(1)})]
    });
    setDb2(db);
    assert.doesNotThrow(() => archiveOldDone());
    assert.equal(getDb2().items.length, 1);
  });
});
