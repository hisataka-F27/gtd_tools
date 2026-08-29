#!/usr/bin/env node
/* =========================================================
   build.js — src/ を1枚の GTDタスク管理ツール.html に結合する。
   Node 標準の fs のみを使う（依存ゼロ）。 `node build.js` で完結する。

   file:// で開いても動くことが最優先の制約のため、
   <script type="module"> は使わない（file:// では CORS で読めない）。
   代わりに「読みやすい src/ を書き、ビルドで1枚に結合する」方式を採る。
   ========================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");
const STYLES_DIR = path.join(SRC, "styles");
const JS_DIR = path.join(SRC, "js");
const INDEX_HTML = path.join(SRC, "index.html");
const OUT_FILE = path.join(ROOT, "GTDタスク管理ツール.html");

function listFilesSorted(dir, ext){
  if(!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith(ext))
    .sort((a, b) => a.localeCompare(b, "en"))
    .map(f => path.join(dir, f));
}

/* テスト用フッター（module.exports ガード）を成果物から取り除く。
   ブラウザ上では無害だが、成果物のノイズになるため。
   各ソースファイルは、フッターの直前に必ずこの一意なマーカー行を置く運用にする
  （正規表現の後方参照的な誤マッチを避けるため、あいまいなパターンではなく
   固定文字列の indexOf で厳密に切り出す）。 */
const TEST_EXPORTS_MARKER = "/* ---- TEST EXPORTS (build.js strips this) ---- */";
function stripTestExportsFooter(src){
  const at = src.indexOf(TEST_EXPORTS_MARKER);
  if(at < 0) return src;
  return src.slice(0, at).replace(/\s+$/, "\n");
}

/* 各ファイルの先頭に「相対パスからの出所コメント」を挿入する。
   成果物を読んだときにも、どのソースファイル由来かが分かるように。 */
function withBoundaryComment(relPath, content){
  const trimmed = content.replace(/\s+$/, "");
  return `/* ==== ${relPath} ==== */\n${trimmed}\n`;
}

/* 結合前チェック：IIFE スコープ内でトップレベル宣言名が重複していないか。
   正規表現ベースの簡易チェック（コメント/文字列内の誤検出まではケアしない）。
   重複があれば SyntaxError になる前に、ここで分かりやすく落とす。 */
function checkNoDuplicateTopLevelNames(files){
  const declRe = /^(?:const|let|var|function)\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm;
  const seen = new Map(); // name -> file
  const dups = [];
  for(const {rel, content} of files){
    let m;
    declRe.lastIndex = 0;
    while((m = declRe.exec(content))){
      const name = m[1];
      if(seen.has(name) && seen.get(name) !== rel){
        dups.push(`"${name}" は ${seen.get(name)} と ${rel} の両方でトップレベル宣言されています`);
      }else{
        seen.set(name, rel);
      }
    }
  }
  if(dups.length){
    throw new Error("重複したトップレベル宣言があります（IIFE結合前チェック）:\n  " + dups.join("\n  "));
  }
}

function buildCSS(){
  const files = listFilesSorted(STYLES_DIR, ".css");
  if(!files.length) throw new Error("src/styles/*.css が見つかりません");
  return files.map(f => {
    const rel = "src/styles/" + path.basename(f);
    return withBoundaryComment(rel, fs.readFileSync(f, "utf8"));
  }).join("\n");
}

function buildJS(){
  const files = listFilesSorted(JS_DIR, ".js");
  if(!files.length) throw new Error("src/js/*.js が見つかりません");
  const parsed = files.map(f => {
    const rel = "src/js/" + path.basename(f);
    const raw = stripTestExportsFooter(fs.readFileSync(f, "utf8"));
    return {rel, content: raw};
  });
  checkNoDuplicateTopLevelNames(parsed);
  const body = parsed.map(({rel, content}) => withBoundaryComment(rel, content)).join("\n");
  return `(function(){\n"use strict";\n${body}\n})();`;
}

function build(){
  if(!fs.existsSync(INDEX_HTML)) throw new Error("src/index.html が見つかりません");
  let html = fs.readFileSync(INDEX_HTML, "utf8");

  if(html.indexOf("<!--INJECT:CSS-->") < 0) throw new Error("src/index.html に <!--INJECT:CSS--> がありません");
  if(html.indexOf("<!--INJECT:JS-->") < 0) throw new Error("src/index.html に <!--INJECT:JS--> がありません");

  html = html.replace("<!--INJECT:CSS-->", () => buildCSS());
  html = html.replace("<!--INJECT:JS-->", () => buildJS());

  fs.writeFileSync(OUT_FILE, html, "utf8");
  console.log("built " + path.relative(ROOT, OUT_FILE));
}

build();
