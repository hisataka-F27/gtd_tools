"use strict";
/* =========================================================
   test/ime.test.js

   isSubmitEnter() — かな漢字変換の「変換確定 Enter」を送信から
   除外できているかの検証。

   この関数が無かった頃は、収集トレイ（#capIn）・プロジェクトの行動追加
   （#pAdd）・コンテキスト追加（#ctxNew）で、変換を確定しただけで項目が
   追加されてしまい、日本語の文章を最後まで入力できなかった。

   ブラウザが変換確定時に投げる keydown は環境で形が違うため、
   実際に観測される組み合わせをそれぞれ模したイベントで固める。
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const { isSubmitEnter } = loadApp();

/* KeyboardEvent の必要な部分だけを模した素のオブジェクト。
   isSubmitEnter は key / isComposing / keyCode しか見ないため、
   DOM を用意せずに判定を検証できる。 */
const ev = (o) => Object.assign({ key: "Enter", isComposing: false, keyCode: 13 }, o);

test("変換していない素の Enter は送信とみなす", () => {
  assert.equal(isSubmitEnter(ev({})), true);
});

test("Chrome/Firefox の変換確定 Enter（isComposing=true）は送信しない", () => {
  assert.equal(isSubmitEnter(ev({ isComposing: true, keyCode: 229 })), false);
});

test("isComposing だけが true でも送信しない", () => {
  assert.equal(isSubmitEnter(ev({ isComposing: true, keyCode: 13 })), false);
});

test("Safari の変換確定 Enter（isComposing=false だが keyCode=229）は送信しない", () => {
  assert.equal(isSubmitEnter(ev({ isComposing: false, keyCode: 229 })), false);
});

test("Enter 以外のキーは、変換中かどうかに関わらず送信ではない", () => {
  assert.equal(isSubmitEnter(ev({ key: "a" })), false);
  assert.equal(isSubmitEnter(ev({ key: " " })), false);
  assert.equal(isSubmitEnter(ev({ key: "Escape" })), false);
  assert.equal(isSubmitEnter(ev({ key: "Process", isComposing: true, keyCode: 229 })), false);
});

test("変換を確定した「次の」Enter は送信とみなす（確定後に改めて押した場合）", () => {
  // 変換確定 → 除外
  assert.equal(isSubmitEnter(ev({ isComposing: true, keyCode: 229 })), false);
  // 確定後にもう一度押した Enter は通常の keydown になる
  assert.equal(isSubmitEnter(ev({ isComposing: false, keyCode: 13 })), true);
});

test("keyCode を持たない環境でも、isComposing が false なら送信とみなす", () => {
  assert.equal(isSubmitEnter({ key: "Enter", isComposing: false }), true);
});
