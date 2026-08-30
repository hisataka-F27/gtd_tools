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
const { loadApp, withDom } = require("./helpers/load-app.js");

const app = loadApp();
const { splitCaptureLines } = app;

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

/* ---------------------------------------------------------
   captureLines() の取り消し（#2 の snapshot との組み合わせ）

   snapshot() は「積んだ時点の db」を取り消し先として保存するため、
   db.items へ追加した【後】に呼ぶと、追加済みの状態が取り消し先として
   保存され、取り消しても何も戻らない。実装ではこれを踏んで一度間違えたので、
   順序そのものを固定するテストを置いておく。
   --------------------------------------------------------- */
const { captureLines, getDb, setDb, getUi, blank, pushUndo, popUndo, undoDepth, resetUndo } = app;

function freshDb(){
  setDb(blank());
  resetUndo();
  /* save() の遅延書き込み（setTimeout → localStorage）を走らせない。
     テストが終わったあとにタイマが動くと、差し戻された document を触って落ちる。 */
  getUi().storeOK = false;
}

test("captureLines: 行数ぶんの項目が収集トレイに入る", () => {
  freshDb();
  assert.equal(withDom(() => captureLines("あ\nい\nう")), true);
  const items = getDb().items;
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(i => i.title), ["あ", "い", "う"]);
  assert.ok(items.every(i => i.state === "inbox"));
});

test("captureLines: 0件のときは何も足さず false を返す", () => {
  freshDb();
  assert.equal(withDom(() => captureLines("  \n\n ")), false);
  assert.equal(getDb().items.length, 0);
  assert.equal(undoDepth(), 0);
});

test("captureLines: 取り消すと貼り付ける前の状態に戻る", () => {
  freshDb();
  withDom(() => captureLines("あ\nい\nう"));
  assert.equal(undoDepth(), 1);
  /* 取り消し先は「貼り付ける前」＝0件でなければならない。
     snapshot() を追加の後に呼ぶと、ここが3件になって取り消しが効かなくなる。 */
  const restored = popUndo();
  assert.equal(restored.items.length, 0);
});

test("captureLines: 既にあった項目は取り消しで消えない", () => {
  freshDb();
  withDom(() => captureLines("さきに1件"));
  resetUndo();
  withDom(() => captureLines("あ\nい"));
  assert.equal(getDb().items.length, 3);
  const restored = popUndo();
  assert.equal(restored.items.length, 1);
  assert.equal(restored.items[0].title, "さきに1件");
});
