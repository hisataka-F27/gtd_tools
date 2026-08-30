"use strict";
/* =========================================================
   test/capture-paste.test.js

   splitCaptureLines() — 複数行ペースト（#3）で「テキスト → 追加すべき行の
   配列」へ変換する純関数の検証。

   <input> は貼り付け時に改行を空白へ潰してしまうため、実際の配線は
   #capIn の paste イベントで e.clipboardData.getData("text") から
   生のテキストを読む（src/js/90-app.js の captureLines() を参照）。
   ここではその手前の、DOM に依存しない分割ロジックだけを検証する。
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const { splitCaptureLines } = loadApp();

test("改行なしの貼り付けは1要素", () => {
  assert.deepEqual(splitCaptureLines("ひとつだけ"), ["ひとつだけ"]);
});

test("改行区切りは行ごとに分割される", () => {
  assert.deepEqual(splitCaptureLines("a\nb\nc"), ["a", "b", "c"]);
});

test("空行は捨て、前後の空白は trim される", () => {
  assert.deepEqual(splitCaptureLines("a\n\n  b  \n"), ["a", "b"]);
});

test("空文字・空白だけの入力は空配列", () => {
  assert.deepEqual(splitCaptureLines(""), []);
  assert.deepEqual(splitCaptureLines("   "), []);
  assert.deepEqual(splitCaptureLines("\n\n  \n"), []);
});

test("CRLF 改行も分割される", () => {
  assert.deepEqual(splitCaptureLines("a\r\nb"), ["a", "b"]);
});

test("null / undefined は空配列（防御的）", () => {
  assert.deepEqual(splitCaptureLines(null), []);
  assert.deepEqual(splitCaptureLines(undefined), []);
});
