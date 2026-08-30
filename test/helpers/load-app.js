"use strict";
/* =========================================================
   test/helpers/load-app.js
   src/js/*.js を build.js と同じファイル名昇順で結合し、
   Node の vm でブラウザに近い最小限のスタブ環境の中で実行する。

   各ソースファイル末尾の
     if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {...})
   というテスト用フッターが、この vm コンテキストの module.exports に
   純粋関数（DOM/localStorage に触れないもの）を集約する。
   build.js はこのフッターを成果物から取り除くため、ブラウザ側の
   挙動には一切影響しない。

   注意: vm.createContext() で新しい Realm を作ると、その中で作られる
   Array/Object はテスト側（ホストRealm）の Array/Object とは「別物」になり、
   assert.deepEqual が「構造は同じだが同一実体でない」と失敗する。
   そのため、ここでは新しい Realm は作らず vm.Script + runInThisContext で
   ホストと同じ Realm 上に一段トップレベルスコープを作るだけにする。
   document/window などブラウザ専有オブジェクトだけを一時的に
   グローバルへ差し込み、実行後に元へ戻す。
   ========================================================= */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const JS_DIR = path.join(__dirname, "..", "..", "src", "js");

function noop(){}

/* click()/focus() など、呼び出し得るメソッド名を網羅しなくて済むように
   Proxy で「未知のメソッドは no-op 関数を返す」フェイク要素にする。
   このテストで検証したいのは純粋ロジックのみで、DOM 操作の結果は見ない。 */
function makeFakeElement(){
  const state = {
    classList: { add: noop, remove: noop, contains: () => false },
    style: {},
    dataset: {},
    value: "",
    textContent: "",
    innerHTML: "",
    files: []
  };
  return new Proxy(state, {
    get(target, prop){
      if(prop in target) return target[prop];
      return noop;
    },
    set(target, prop, value){
      target[prop] = value;
      return true;
    }
  });
}

function makeFakeDocument(){
  return {
    getElementById: () => makeFakeElement(),
    querySelector: () => makeFakeElement(),
    querySelectorAll: () => [],
    createElement: makeFakeElement,
    body: { appendChild: noop },
    addEventListener: noop,
    title: ""
  };
}

const BROWSER_GLOBALS = {
  document: makeFakeDocument,
  window: () => ({
    addEventListener: noop,
    localStorage: undefined,
    confirm: () => true,
    alert: noop,
    open: () => null
  }),
  navigator: () => ({ clipboard: undefined }),
  URL: () => ({ createObjectURL: () => "", revokeObjectURL: noop }),
  Blob: () => (function Blob(){})
};

/* src/js/*.js をビルドと同じ順序で結合し、実行して module.exports を回収する。
   同じホスト Realm 上で実行するため、テスト側の Array/Object/assert.deepEqual と
   食い違わない。 */
/* ブラウザ専有オブジェクトをグローバルへ差し込み、元の記述子を返す。 */
function installBrowserGlobals(){
  const saved = {};
  for(const key of Object.keys(BROWSER_GLOBALS)){
    saved[key] = Object.getOwnPropertyDescriptor(global, key);
    Object.defineProperty(global, key, {
      value: BROWSER_GLOBALS[key](),
      writable: true, configurable: true, enumerable: true
    });
  }
  return saved;
}
function restoreBrowserGlobals(saved){
  for(const key of Object.keys(BROWSER_GLOBALS)){
    const desc = saved[key];
    if(desc) Object.defineProperty(global, key, desc);
    else delete global[key];
  }
}

/* loadApp() の実行が終わるとスタブは元へ戻るため、読み込んだあとに
   DOM を触る関数（renderAll を呼ぶアクション等）をテストから呼ぶと
   `document is not defined` で落ちる。そういう関数を呼ぶ間だけ、
   同じスタブを差し込み直すための入れ物。 */
function withDom(fn){
  const saved = installBrowserGlobals();
  try{ return fn(); }
  finally{ restoreBrowserGlobals(saved); }
}

function loadApp(){
  const files = fs.readdirSync(JS_DIR)
    .filter(f => f.endsWith(".js"))
    .sort((a, b) => a.localeCompare(b, "en"));
  const code = files
    .map(f => fs.readFileSync(path.join(JS_DIR, f), "utf8"))
    .join("\n;\n");

  /* Node 20+ には navigator など読み取り専用アクセサのグローバルが
     もとから存在するため、単純代入ではなく defineProperty で一時的に上書きする。 */
  const savedDescriptors = installBrowserGlobals();

  const moduleExports = {};
  try{
    const wrapped = `(function(module){\n${code}\n})`;
    const script = new vm.Script(wrapped, { filename: "bundle-under-test.js" });
    const fn = script.runInThisContext();
    fn({ exports: moduleExports });
  } finally {
    restoreBrowserGlobals(savedDescriptors);
  }
  return moduleExports;
}

module.exports = { loadApp, withDom };
