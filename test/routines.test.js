"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.js");

const app = loadApp();
const { tplHits, tplNextDate, cycleLabel, tplRanToday, today } = app;

function tpl(overrides){
  return Object.assign({
    id: "t1", title: "テスト", cycle: "daily", weekdays: [], monthday: 1, lastRun: null
  }, overrides);
}

test("tplHits: daily は常に true", () => {
  assert.equal(tplHits(tpl({cycle:"daily"}), "2026-08-29"), true);
  assert.equal(tplHits(tpl({cycle:"daily"}), "2026-01-01"), true);
});

test("tplHits: weekly は指定曜日のみ true（複数曜日）", () => {
  // 2026-08-29 は土曜(6), 2026-08-31 は月曜(1)
  const t = tpl({cycle:"weekly", weekdays:[1,6]});
  assert.equal(tplHits(t, "2026-08-29"), true);  // 土
  assert.equal(tplHits(t, "2026-08-31"), true);  // 月
  assert.equal(tplHits(t, "2026-08-30"), false); // 日
});

test("tplHits: weekly で weekdays が空なら常に false", () => {
  assert.equal(tplHits(tpl({cycle:"weekly", weekdays:[]}), "2026-08-29"), false);
});

test("tplHits: monthly は指定日のみ true", () => {
  const t = tpl({cycle:"monthly", monthday:15});
  assert.equal(tplHits(t, "2026-08-15"), true);
  assert.equal(tplHits(t, "2026-08-14"), false);
  assert.equal(tplHits(t, "2026-08-16"), false);
});

test("tplHits: monthly 31日指定は月末に丸まる（2月は28/29日）", () => {
  const t = tpl({cycle:"monthly", monthday:31});
  assert.equal(tplHits(t, "2026-02-28"), true);  // 2026年は平年
  assert.equal(tplHits(t, "2024-02-29"), true);  // 2024年はうるう年
  assert.equal(tplHits(t, "2026-04-30"), true);  // 4月は30日まで
  assert.equal(tplHits(t, "2026-08-31"), true);  // 8月は31日まである
});

test("tplHits: monthly 31日指定は当該月の31日を超えた日には反応しない", () => {
  const t = tpl({cycle:"monthly", monthday:31});
  assert.equal(tplHits(t, "2026-04-29"), false); // 4月は30日が末日なので29日はまだ違う
});

test("tplHits: adhoc は常に false（自分で選んだときだけ投入されるため）", () => {
  assert.equal(tplHits(tpl({cycle:"adhoc"}), "2026-08-29"), false);
});

test("tplNextDate: daily/adhoc は今日", () => {
  assert.equal(tplNextDate(tpl({cycle:"daily"})), today());
  assert.equal(tplNextDate(tpl({cycle:"adhoc"})), today());
});

test("tplNextDate: weekly は次に該当する曜日の日付", () => {
  const t = tpl({cycle:"weekly", weekdays:[1,6]});
  const next = tplNextDate(t);
  const d = new Date(next + "T00:00:00");
  assert.ok([1,6].includes(d.getDay()));
  // today() 以降（当日を含む）であること
  assert.ok(next >= today());
});

test("tplNextDate: monthly 31日指定は月末丸めの次回日を返す", () => {
  const t = tpl({cycle:"monthly", monthday:31});
  const next = tplNextDate(t);
  const d = new Date(next + "T00:00:00");
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  assert.equal(d.getDate(), last);
});

test("cycleLabel: daily/adhoc は CYCLES の表記", () => {
  assert.equal(cycleLabel(tpl({cycle:"daily"})), "毎日");
  assert.equal(cycleLabel(tpl({cycle:"adhoc"})), "随時");
});

test("cycleLabel: weekly は複数曜日を昇順・「・」区切りで表示", () => {
  assert.equal(cycleLabel(tpl({cycle:"weekly", weekdays:[6,1]})), "毎週 月・土");
});

test("cycleLabel: weekly で未指定なら「未指定」", () => {
  assert.equal(cycleLabel(tpl({cycle:"weekly", weekdays:[]})), "毎週 未指定");
});

test("cycleLabel: monthly は「毎月N日」", () => {
  assert.equal(cycleLabel(tpl({cycle:"monthly", monthday:5})), "毎月 5日");
  assert.equal(cycleLabel(tpl({cycle:"monthly", monthday:0})), "毎月 1日"); // 0以下は1に丸め
});

test("tplRanToday: lastRun が今日なら true", () => {
  assert.equal(tplRanToday(tpl({lastRun: today()})), true);
  assert.equal(tplRanToday(tpl({lastRun: null})), false);
  assert.equal(tplRanToday(tpl({lastRun: "2000-01-01"})), false);
});
