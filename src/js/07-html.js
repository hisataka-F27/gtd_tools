/* =========================================================
   自動エスケープする html`` テンプレートタグ（Phase 6）

   通常のテンプレートリテラルは埋め込んだ値をそのまま文字列化するため、
   HTML に差し込む箇所ごとに esc() を手で呼ぶ必要があった（呼び忘れると
   そのまま XSS になる）。html`` タグ付きテンプレートは、${...} に
   埋め込んだ値を renderValue() 経由で自動的にエスケープすることで、
   「埋め込みは自動で安全」をデフォルトにする。

   埋め込み値の扱い:
   - null / undefined            → 空文字
   - 配列                        → 各要素を renderValue() した上で連結（join("")）
                                    ＝ .map(...).join("") で作った部分HTML片の配列を
                                    そのまま渡せる
   - raw() で包んだ値            → エスケープせずそのまま埋め込む（信頼できる、
                                    すでに構築済みの HTML 断片を差し込むときだけ使う）
   - それ以外（文字列・数値等）  → esc() で文字列化＋エスケープ
   ========================================================= */
function renderValue(v){
  if(v == null) return "";
  if(Array.isArray(v)) return v.map(renderValue).join("");
  if(v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "__raw")) return v.__raw;
  return esc(v);
}
function html(strings, ...vals){
  return strings.reduce((acc, s, i) => acc + s + (i < vals.length ? renderValue(vals[i]) : ""), "");
}
/** すでに安全と分かっている（自分で構築した）HTML文字列をエスケープせず埋め込む。
    esc() 済みの断片や、html`` で作った部分HTML片を差し込むときに使う。 */
const raw = s => ({__raw: String(s)});

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  html, raw, renderValue
});
