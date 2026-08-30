"use strict";
/* =========================================================
   test/export-reminder.test.js
   #11 レビュー履歴の表示と書き出しの催促（PLAN-P2.md ステップB）
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const {
  exportReminder, EXPORT_REMIND_DAYS, normalize, setDb, getDb, blank, MODEL_VERSION, MIGRATIONS
} = app;

/* exportReminder() は "YYYY-MM-DD" 文字列を new Date() に直接渡して比較する。
   その形の文字列は ES 仕様上 UTC の 00:00 として解釈されるため、ここでの
   日付計算もローカルタイムゾーンに引きずられないよう UTC で揃える。 */
function daysAgoStr(base, n){
  const d = new Date(base + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

const TODAY = "2026-08-30";

/* ---- exportReminder() ---- */

test("exportReminder: lastExport が null なら level:never", () => {
  assert.deepEqual(exportReminder(null, TODAY), {level: "never", days: 0});
});

test("exportReminder: 今日書き出していれば level:ok, days:0", () => {
  const r = exportReminder(TODAY, TODAY);
  assert.equal(r.level, "ok");
  assert.equal(r.days, 0);
});

test("exportReminder: 13日前なら level:ok", () => {
  const r = exportReminder(daysAgoStr(TODAY, 13), TODAY);
  assert.equal(r.level, "ok");
  assert.equal(r.days, 13);
});

test("exportReminder: 14日前ちょうどなら level:stale（境界含む）", () => {
  const r = exportReminder(daysAgoStr(TODAY, EXPORT_REMIND_DAYS), TODAY);
  assert.equal(r.level, "stale");
  assert.equal(r.days, EXPORT_REMIND_DAYS);
});

test("exportReminder: 40日前なら level:stale, days:40", () => {
  const r = exportReminder(daysAgoStr(TODAY, 40), TODAY);
  assert.equal(r.level, "stale");
  assert.equal(r.days, 40);
});

/* ---- マイグレーション（旧データ互換） ---- */

test("マイグレーション: version:2 の db を normalize() すると lastExport:null が入り、既存の値は書き換わらない", () => {
  const db = Object.assign(blank(), {
    version: 2,
    lastExport: undefined,
    items: []
  });
  delete db.lastExport;
  setDb(db);
  assert.doesNotThrow(() => normalize());
  const got = getDb();
  assert.equal(got.version, MODEL_VERSION);
  assert.equal(got.lastExport, null);
});

test("マイグレーション: version フィールドを持たない旧データでも例外なく lastExport:null が入る", () => {
  const db = {
    items: [],
    projects: [],
    templates: [],
    contexts: ["@PC"],
    review: {last: null, history: []}
  };
  setDb(db);
  assert.doesNotThrow(() => normalize());
  const got = getDb();
  assert.equal(got.version, MODEL_VERSION);
  assert.equal(got.lastExport, null);
});

test("マイグレーション: 既に lastExport を持つ db の値は normalize() で書き換わらない", () => {
  const db = Object.assign(blank(), {version: 2, lastExport: "2026-08-01"});
  setDb(db);
  normalize();
  assert.equal(getDb().lastExport, "2026-08-01");
});

/* ---- MIGRATIONS[1] / MIGRATIONS[2] が残っていることの確認 ---- */

test("MIGRATIONS[1] と MIGRATIONS[2] は変更・削除されていない", () => {
  assert.equal(typeof MIGRATIONS[1], "function");
  assert.equal(typeof MIGRATIONS[2], "function");
  assert.equal(typeof MIGRATIONS[3], "function");
});
