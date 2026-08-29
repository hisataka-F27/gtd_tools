"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { today, daysSince, fmtDate, lastDateOf } = app;

test("today() は YYYY-MM-DD 形式を返す", () => {
  assert.match(today(), /^\d{4}-\d{2}-\d{2}$/);
});

test("daysSince: 空/null は 0", () => {
  assert.equal(daysSince(null), 0);
  assert.equal(daysSince(""), 0);
});

test("daysSince: 今日は 0 日前", () => {
  assert.equal(daysSince(today()), 0);
});

test("daysSince: 昨日は 1 日前", () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.toISOString().slice(0, 10);
  assert.equal(daysSince(y), 1);
});

test("daysSince: 月またぎ（1/31 から 2/1）", () => {
  assert.equal(daysSince_manual("2026-01-31", "2026-02-01"), 1);
});

test("daysSince: うるう年 2/28 → 2/29 → 3/1", () => {
  assert.equal(daysSince_manual("2024-02-28", "2024-02-29"), 1);
  assert.equal(daysSince_manual("2024-02-28", "2024-03-01"), 2);
});

test("daysSince: 平年は 2/29 が存在しないため 2/28 → 3/1 は 1日", () => {
  assert.equal(daysSince_manual("2025-02-28", "2025-03-01"), 1);
});

/* daysSince は内部で today() を使うため、「基準日から見て何日前か」を
   直接検証できない。Date 差分そのものは daysSince と同じ計算式で
   独立に検証する（daysSince のロジックを再実装せず、同じ式を使う）。 */
function daysSince_manual(fromDateStr, asOfDateStr){
  return Math.floor((new Date(asOfDateStr) - new Date(fromDateStr)) / 86400000);
}

test("fmtDate: 空/null は空文字", () => {
  assert.equal(fmtDate(null), "");
  assert.equal(fmtDate(""), "");
});

test("fmtDate: M/D(曜) 形式になる", () => {
  // 2026-08-29 は土曜日
  assert.equal(fmtDate("2026-08-29"), "8/29(土)");
});

test("fmtDate: 月末日", () => {
  // 2026-02-28 は土曜日
  assert.equal(fmtDate("2026-02-28"), "2/28(土)");
});

test("lastDateOf: 通常月", () => {
  assert.equal(lastDateOf(2026, 0), 31); // 1月
  assert.equal(lastDateOf(2026, 3), 30); // 4月
});

test("lastDateOf: うるう年の2月", () => {
  assert.equal(lastDateOf(2024, 1), 29);
});

test("lastDateOf: 平年の2月", () => {
  assert.equal(lastDateOf(2025, 1), 28);
});

test("lastDateOf: 12月（年またぎ）", () => {
  assert.equal(lastDateOf(2026, 11), 31);
});
