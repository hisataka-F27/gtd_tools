#!/usr/bin/env node
/* =========================================================
   test/fixtures/golden.json を生成するスクリプト
   - 元ファイル GTDタスク管理ツール.html の blank()/newItem() の
     フィールド形状に合わせて、手作業の代わりにプログラムで
     「黄金フィクスチャ」を組み立てる。
   - `node test/fixtures/make-golden.js` で golden.json を上書き生成する。
   - 日付は実行時点の「今日」を基準にした相対値（xx日前）で埋める。
     これにより、いつテストを実行しても
     overdue / stale(14日+) / oldWaiting(7日+) の境界を満たし続ける。
   ========================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

function today(){ return new Date().toISOString().slice(0,10); }
function daysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0,10);
}
function daysFromNow(n){
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0,10);
}
let seq = 0;
function uid(){ seq += 1; return "gld" + String(seq).padStart(4, "0"); }

function newItem(overrides){
  const base = {
    id: uid(), title: "", note: "", state: "inbox", context: "",
    project: null, due: null, who: "", since: null,
    minutes: 0, energy: "", created: today(), updated: today(), doneAt: null
  };
  return Object.assign(base, overrides);
}

const projects = [
  {
    id: uid(), name: "オフィス移転プロジェクト", outcome: "新オフィスで全員が業務を開始できる状態",
    status: "active", created: daysAgo(40)
  },
  {
    id: uid(), name: "<script>alert(1)</script> & \"引用符\" 'テスト'",
    outcome: "記号と日本語が混じった名前でも表示崩れしない",
    status: "active", created: daysAgo(10)
  }
];
const [prjOffice, prjSymbols] = projects;

const items = [];

// 1) inbox — 収集トレイ（未処理）
items.push(newItem({
  title: "会議室の予約表を確認する",
  state: "inbox",
  created: daysAgo(1), updated: daysAgo(1)
}));

// 2) inbox — 記号 + 日本語タイトル（エスケープ確認用）
items.push(newItem({
  title: "<b>重要</b> & 至急 \"確認\" 'お願いします' <script>alert(1)</script>",
  note: "記号 <>&\"' を含むメモ。",
  state: "inbox",
  created: daysAgo(0), updated: daysAgo(0)
}));

// 3) next — 通常の次のアクション
items.push(newItem({
  title: "見積書のドラフトを作成する",
  context: "@PC", minutes: 30, energy: "high",
  project: prjOffice.id,
  state: "next",
  created: daysAgo(5), updated: daysAgo(1)
}));

// 4) next — 14日以上更新されていない「停滞」判定用
items.push(newItem({
  title: "旧システムのマニュアルを整理する",
  context: "@自宅", minutes: 60, energy: "low",
  state: "next",
  created: daysAgo(30), updated: daysAgo(14)
}));

// 5) waiting — 通常の待ち
items.push(newItem({
  title: "見積の承認を待つ",
  who: "田中さん", since: daysAgo(2),
  state: "waiting",
  project: prjOffice.id,
  created: daysAgo(2), updated: daysAgo(2)
}));

// 6) waiting — 7日以上前からの「督促」判定用
items.push(newItem({
  title: "契約書の返送を待つ",
  who: "先方法務部", since: daysAgo(7),
  state: "waiting",
  created: daysAgo(9), updated: daysAgo(9)
}));

// 7) calendar — 期限切れ（overdue）
items.push(newItem({
  title: "健康診断の予約を確定する",
  due: daysAgo(3),
  state: "calendar",
  created: daysAgo(20), updated: daysAgo(20)
}));

// 8) calendar — 今後の予定（overdueにならないこと確認用）
items.push(newItem({
  title: "月次報告を提出する",
  due: daysFromNow(5),
  state: "calendar",
  created: daysAgo(1), updated: daysAgo(1)
}));

// 9) someday — いつか/たぶん
items.push(newItem({
  title: "スペイン語を学び直す",
  state: "someday",
  created: daysAgo(60), updated: daysAgo(60)
}));

// 10) reference — 資料
items.push(newItem({
  title: "新オフィスのフロアマップ",
  note: "参照用。行動不要。",
  state: "reference",
  project: prjOffice.id,
  created: daysAgo(15), updated: daysAgo(15)
}));

// 11) done — 完了
items.push(newItem({
  title: "引っ越し業者の見積を3社比較する",
  state: "done",
  project: prjOffice.id,
  created: daysAgo(20), updated: daysAgo(4), doneAt: daysAgo(4)
}));

// 12) next — 記号タイトルのプロジェクトに紐づく行動
items.push(newItem({
  title: "\"テスト\" プロジェクトの一手目",
  context: "@電話",
  project: prjSymbols.id,
  state: "next",
  created: daysAgo(3), updated: daysAgo(1)
}));

const templates = [
  {
    id: uid(), title: "日報を書いて提出する", note: "所感1行＋翌日予定",
    context: "@PC", minutes: 15, energy: "low", project: null,
    target: "next", cycle: "daily", weekdays: [], monthday: 1,
    lastRun: null, created: daysAgo(90)
  },
  {
    id: uid(), title: "週次の勤怠を入力する", note: "",
    context: "@PC", minutes: 10, energy: "", project: null,
    target: "next", cycle: "weekly", weekdays: [1, 5], monthday: 1,
    lastRun: null, created: daysAgo(90)
  },
  {
    id: uid(), title: "月初の在庫棚卸しをする", note: "月末は末日に丸める",
    context: "@出社時", minutes: 60, energy: "high", project: prjOffice.id,
    target: "calendar", cycle: "monthly", weekdays: [], monthday: 31,
    lastRun: null, created: daysAgo(90)
  },
  {
    id: uid(), title: "四半期レビュー資料を作る", note: "自分で選んだときだけ投入",
    context: "", minutes: 120, energy: "high", project: null,
    target: "next", cycle: "adhoc", weekdays: [], monthday: 1,
    lastRun: null, created: daysAgo(90)
  }
];

const contexts = ["@PC", "@電話", "@外出", "@打合せ", "@自宅", "@出社時", "@田中さんと"];

const golden = {
  version: 1,
  appName: "みなも",
  appTag: "MIND LIKE WATER",
  items,
  projects,
  templates,
  contexts,
  review: {
    last: daysAgo(9),
    history: [daysAgo(9), daysAgo(16), daysAgo(23)]
  },
  build: "golden-fixture"
};

const outPath = path.join(__dirname, "golden.json");
fs.writeFileSync(outPath, JSON.stringify(golden, null, 2) + "\n", "utf8");
console.log("wrote " + outPath + " (" + items.length + " items, " + projects.length + " projects, " + templates.length + " templates)");
