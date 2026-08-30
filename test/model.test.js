"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { blank, normalize, newItem, setDb, getDb, MODEL_VERSION, MIGRATIONS } = app;

test("blank: 初期データの形状", () => {
  const b = blank();
  assert.equal(b.version, MODEL_VERSION);
  assert.equal(b.appName, "みなも");
  assert.equal(b.appTag, "MIND LIKE WATER");
  assert.deepEqual(b.items, []);
  assert.deepEqual(b.projects, []);
  assert.deepEqual(b.templates, []);
  assert.deepEqual(b.contexts, ["@PC","@電話","@外出","@打合せ","@自宅"]);
  assert.deepEqual(b.review, {last:null, history:[]});
});

test("newItem: 欠損なくフィールドが揃う", () => {
  const it = newItem("行動する");
  assert.equal(it.title, "行動する");
  assert.equal(it.state, "inbox");
  assert.equal(it.note, "");
  assert.equal(it.context, "");
  assert.equal(it.project, null);
  assert.equal(it.due, null);
  assert.equal(it.who, "");
  assert.equal(it.since, null);
  assert.equal(it.minutes, 0);
  assert.equal(it.energy, "");
  assert.equal(it.doneAt, null);
  assert.equal(it.flagged, null);
  assert.match(it.created, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(it.updated, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(it.id && it.id.length > 0);
});

test("newItem: idはコールごとに一意", () => {
  const a = newItem("a"), b = newItem("b");
  assert.notEqual(a.id, b.id);
});

test("normalize: 完全に空のdbでも欠損フィールドを補う", () => {
  setDb({items: []});
  normalize();
  const db = getDb();
  assert.deepEqual(db.contexts, ["@PC","@電話","@外出","@打合せ","@自宅"]);
  assert.deepEqual(db.projects, []);
  assert.deepEqual(db.templates, []);
  assert.deepEqual(db.review, {last:null, history:[]});
  assert.equal(db.appName, "みなも");
  assert.equal(db.appTag, "MIND LIKE WATER");
});

test("normalize: 既存の値は上書きしない（旧データ互換）", () => {
  setDb({
    items: [],
    contexts: ["@独自1", "@独自2"],
    projects: [{id:"p1", name:"既存プロジェクト"}],
    review: {last:"2026-01-01", history:["2026-01-01"]},
    appName: "カスタム名",
    appTag: ""
  });
  normalize();
  const db = getDb();
  assert.deepEqual(db.contexts, ["@独自1", "@独自2"]);
  assert.equal(db.projects.length, 1);
  assert.equal(db.review.last, "2026-01-01");
  assert.equal(db.appName, "カスタム名");
  assert.equal(db.appTag, ""); // 空文字は「未設定」ではないので上書きされない（appTag==null のときだけ補う）
});

test("normalize: appTag が undefined/null のときだけ既定値を補う", () => {
  setDb({items: []}); // appTag は未設定
  normalize();
  assert.equal(getDb().appTag, "MIND LIKE WATER");
});

test("normalize: version フィールドが無い旧データ（minamo.gtd.v1 の実データ相当）を読める", () => {
  // 昔の保存データには version フィールド自体が無かった。0 扱いでマイグレーションが走り、
  // 最終的に version が現行値まで引き上げられ、既存の値は保持されることを確認する。
  setDb({
    items: [{id:"old1", title:"昔からある項目", state:"next"}],
    contexts: ["@自作コンテキスト"],
    appName: "古いツール名"
  });
  normalize();
  const db = getDb();
  assert.equal(db.version, MODEL_VERSION);
  assert.equal(db.items.length, 1);
  assert.equal(db.items[0].title, "昔からある項目");
  assert.deepEqual(db.contexts, ["@自作コンテキスト"]); // 既存値は上書きされない
  assert.equal(db.appName, "古いツール名");
  // version が無かった分だけ欠けていたフィールドは補われる
  assert.deepEqual(db.projects, []);
  assert.deepEqual(db.templates, []);
  assert.deepEqual(db.review, {last:null, history:[]});
});

test("normalize: version が既に現行値のデータはそのまま（再マイグレーションしない）", () => {
  setDb({
    version: MODEL_VERSION,
    items: [],
    contexts: ["@すでに正規化済み"],
    projects: [{id:"p1", name:"既存"}],
    templates: [],
    review: {last:"2026-02-02", history:["2026-02-02"]},
    appName: "維持されるべき名前",
    appTag: ""
  });
  normalize();
  const db = getDb();
  assert.equal(db.version, MODEL_VERSION);
  assert.deepEqual(db.contexts, ["@すでに正規化済み"]);
  assert.equal(db.appName, "維持されるべき名前");
  assert.equal(db.appTag, "");
});

test("normalize: フィールドが部分的に欠損したデータ（一部だけ壊れている）も補われる", () => {
  setDb({
    items: [{id:"i1", title:"a", state:"inbox"}],
    projects: [{id:"p1", name:"既存プロジェクト"}],
    // contexts / templates / review / appName / appTag が丸ごと欠けている
  });
  normalize();
  const db = getDb();
  assert.deepEqual(db.contexts, blank().contexts);
  assert.deepEqual(db.templates, []);
  assert.deepEqual(db.review, {last:null, history:[]});
  assert.equal(db.appName, "みなも");
  assert.equal(db.appTag, "MIND LIKE WATER");
  assert.equal(db.projects.length, 1); // 既存の projects は保持される
});

test("MIGRATIONS: 2段だけ定義されており MODEL_VERSION と一致する（将来の段追加の目印）", () => {
  assert.equal(MODEL_VERSION, 2);
  assert.deepEqual(Object.keys(MIGRATIONS).map(Number).sort(), [1, 2]);
});

test("normalize: golden.json フィクスチャを読み込んでも壊れない", () => {
  const golden = require("./fixtures/golden.json");
  // オブジェクトのコピーに対して正規化する（フィクスチャ自体を変更しない）
  const copy = JSON.parse(JSON.stringify(golden));
  setDb(copy);
  assert.doesNotThrow(() => normalize());
  const db = getDb();
  assert.equal(db.items.length, golden.items.length);
  assert.equal(db.projects.length, golden.projects.length);
  assert.equal(db.templates.length, golden.templates.length);
  assert.equal(db.contexts.length, golden.contexts.length);
});
