"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { shouldRotateBackup } = app;

test("shouldRotateBackup: 同日なら退避しない（false）", () => {
  assert.equal(shouldRotateBackup("2026-08-30", "2026-08-30"), false);
});

test("shouldRotateBackup: 別日なら退避する（true）", () => {
  assert.equal(shouldRotateBackup("2026-08-29", "2026-08-30"), true);
});

test("shouldRotateBackup: bakAt が null なら退避する（true）", () => {
  assert.equal(shouldRotateBackup(null, "2026-08-30"), true);
});

test("shouldRotateBackup: bakAt が不正な文字列でも退避する（true）", () => {
  assert.equal(shouldRotateBackup("not-a-date", "2026-08-30"), true);
});
