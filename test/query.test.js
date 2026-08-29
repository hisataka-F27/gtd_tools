"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const {
  counts, staleNext, oldWaiting, overdue, projectNeedsAction,
  haystack, visible, ctxUse, setDb, setUi, blank, today
} = app;

function daysAgo(n){
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysFromNow(n){ return daysAgo(-n); }

function baseItem(overrides){
  return Object.assign({
    id: "i1", title: "行動", note: "", state: "next", context: "",
    project: null, due: null, who: "", since: null, minutes: 0, energy: "",
    created: today(), updated: today(), doneAt: null
  }, overrides);
}

function setDbWith(overrides){
  const db = Object.assign(blank(), overrides);
  setDb(db);
  return db;
}

test("counts: 各stateの件数と稼働中プロジェクト数を数える", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"inbox"}),
      baseItem({id:"b", state:"next"}),
      baseItem({id:"c", state:"next"}),
      baseItem({id:"d", state:"done"})
    ],
    projects: [
      {id:"p1", name:"P1", status:"active"},
      {id:"p2", name:"P2", status:"done"}
    ]
  });
  const c = counts();
  assert.equal(c.inbox, 1);
  assert.equal(c.next, 2);
  assert.equal(c.done, 1);
  assert.equal(c.waiting, 0);
  assert.equal(c.projects, 1);
});

test("staleNext: 14日以上前に更新された next のみ（境界値ちょうど14日は含む）", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"next", updated: daysAgo(14)}),
      baseItem({id:"b", state:"next", updated: daysAgo(13)}),
      baseItem({id:"c", state:"next", updated: daysAgo(20)}),
      baseItem({id:"d", state:"waiting", updated: daysAgo(20)})
    ]
  });
  const ids = staleNext().map(i => i.id).sort();
  assert.deepEqual(ids, ["a", "c"]);
});

test("oldWaiting: 7日以上前から待ちのみ（境界値ちょうど7日は含む）。sinceが無ければcreatedを使う", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"waiting", since: daysAgo(7), created: daysAgo(30)}),
      baseItem({id:"b", state:"waiting", since: daysAgo(6), created: daysAgo(30)}),
      baseItem({id:"c", state:"waiting", since: null, created: daysAgo(7)}),
      baseItem({id:"d", state:"waiting", since: null, created: daysAgo(6)})
    ]
  });
  const ids = oldWaiting().map(i => i.id).sort();
  assert.deepEqual(ids, ["a", "c"]);
});

test("overdue: 期限当日は overdue に含まれない。過ぎた日のみ。doneは除外", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"next", due: daysAgo(1)}),      // 過ぎている
      baseItem({id:"b", state:"next", due: today()}),          // 当日はoverdueでない
      baseItem({id:"c", state:"next", due: daysFromNow(1)}),   // 未来
      baseItem({id:"d", state:"next", due: null}),             // 期限なし
      baseItem({id:"e", state:"done", due: daysAgo(5)})        // 完了済みは除外
    ]
  });
  const ids = overdue().map(i => i.id).sort();
  assert.deepEqual(ids, ["a"]);
});

test("projectNeedsAction: next/calendar/waiting のいずれも無ければ true", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"someday", project:"p1"})
    ],
    projects: [{id:"p1", name:"P1", status:"active"}]
  });
  assert.equal(projectNeedsAction({id:"p1"}), true);
});

test("projectNeedsAction: next/calendar/waiting のいずれかがあれば false", () => {
  setDbWith({
    items: [
      baseItem({id:"a", state:"next", project:"p1"})
    ]
  });
  assert.equal(projectNeedsAction({id:"p1"}), false);
});

test("haystack: 検索対象は本文・メモ・待ち相手・コンテキスト・所属プロジェクト名/望む結果", () => {
  setDbWith({
    projects: [{id:"p1", name:"オフィス移転", outcome:"新居で開始できる"}]
  });
  const i = baseItem({
    title:"見積", note:"至急", who:"田中さん", context:"@PC", project:"p1"
  });
  const h = haystack(i);
  assert.ok(h.includes("見積"));
  assert.ok(h.includes("至急"));
  assert.ok(h.includes("田中さん"));
  assert.ok(h.includes("@pc")); // 小文字化される
  assert.ok(h.includes("オフィス移転"));
  assert.ok(h.includes("新居で開始できる"));
});

test("visible: ui.q が空なら絞り込まない", () => {
  setUi({q: ""});
  const list = [baseItem({id:"a", title:"あ"}), baseItem({id:"b", title:"い"})];
  assert.deepEqual(visible(list), list);
});

test("visible: 大文字小文字を無視した部分一致で絞り込む", () => {
  setDbWith({});
  setUi({q: "PC"});
  const list = [
    baseItem({id:"a", context:"@pc"}),
    baseItem({id:"b", context:"@自宅"})
  ];
  const ids = visible(list).map(i => i.id);
  assert.deepEqual(ids, ["a"]);
});

test("ctxUse: 未完了の項目のみコンテキスト使用数に数える", () => {
  setDbWith({
    items: [
      baseItem({id:"a", context:"@PC", state:"next"}),
      baseItem({id:"b", context:"@PC", state:"done"}),
      baseItem({id:"c", context:"@自宅", state:"next"})
    ]
  });
  assert.equal(ctxUse("@PC"), 1);
  assert.equal(ctxUse("@自宅"), 1);
  assert.equal(ctxUse("@存在しない"), 0);
});

test("統合: golden.json を読み込んで visible()/counts() が壊れず動く", () => {
  const golden = require("./fixtures/golden.json");
  setDb(golden);
  const c = counts();
  assert.equal(c.inbox + c.next + c.waiting + c.calendar + c.someday + c.reference + c.done, golden.items.length);
  setUi({q: "オフィス"});
  const hits = visible(golden.items.filter(i => i.project));
  assert.ok(hits.length >= 1);
});
