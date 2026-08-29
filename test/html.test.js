"use strict";
/* =========================================================
   test/html.test.js
   07-html.js の html`` / raw() / renderValue() を検証する。
   Phase 6 で導入した自動エスケープテンプレートタグの、
   埋め込み値の型ごとの扱い（null/undefined/配列/raw/文字列・数値）を固める。
   ========================================================= */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { html, raw, renderValue } = app;

test("html``: 通常の文字列埋め込みはエスケープされる", () => {
  const v = `<script>alert(1)</script>&"'`;
  const out = html`<p>${v}</p>`;
  assert.equal(out, `<p>&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;&#39;</p>`);
});

test("html``: 埋め込みが無いテンプレートはそのまま", () => {
  assert.equal(html`<div class="x"></div>`, `<div class="x"></div>`);
});

test("html``: null / undefined は空文字になる", () => {
  assert.equal(html`a${null}b${undefined}c`, "abc");
});

test("html``: 数値はそのまま文字列化される（エスケープ対象文字を含まないため無変化）", () => {
  assert.equal(html`${0}`, "0");
  assert.equal(html`${42}`, "42");
});

test("html``: 配列はエスケープした上で結合される（join、区切り文字なし）", () => {
  const out = html`<ul>${["<a>", "b&c", "d"]}</ul>`;
  assert.equal(out, `<ul>&lt;a&gt;b&amp;cd</ul>`);
});

test("html``: raw() で包んだ値はエスケープされずそのまま埋め込まれる", () => {
  const trusted = raw("<b>bold</b>");
  assert.equal(html`<p>${trusted}</p>`, `<p><b>bold</b></p>`);
});

test("html``: raw() でネストした html`` の結果を埋め込んでも二重エスケープしない", () => {
  const inner = html`<span>${"<x>"}</span>`; // "<span>&lt;x&gt;</span>"
  const out = html`<div>${raw(inner)}</div>`;
  assert.equal(out, `<div><span>&lt;x&gt;</span></div>`);
});

test("html``: raw() を通さず html`` の結果をそのまま埋め込むと二重エスケープになる（対比用）", () => {
  const inner = html`<span>${"<x>"}</span>`;
  const out = html`<div>${inner}</div>`;
  // raw() を忘れると & が再エスケープされて壊れることを明示するための対照テスト
  assert.equal(out, `<div>&lt;span&gt;&amp;lt;x&amp;gt;&lt;/span&gt;</div>`);
});

test("html``: 配列の要素が raw() 済みならそれぞれエスケープされずに結合される", () => {
  const out = html`${["<a>", raw("<b>")]}`;
  assert.equal(out, "&lt;a&gt;<b>");
});

test("renderValue: 単体でも html`` と同じルールで変換する", () => {
  assert.equal(renderValue(null), "");
  assert.equal(renderValue(undefined), "");
  assert.equal(renderValue("<a>"), "&lt;a&gt;");
  assert.equal(renderValue(0), "0");
  assert.equal(renderValue(["<a>", "<b>"]), "&lt;a&gt;&lt;b&gt;");
  assert.equal(renderValue(raw("<a>")), "<a>");
});

test("raw(): 数値や null を渡しても String() で文字列化される", () => {
  assert.equal(raw(42).__raw, "42");
  assert.equal(raw(null).__raw, "null");
});
