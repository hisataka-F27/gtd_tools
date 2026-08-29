/* =========================================================
   みなも — GTD ワークスペース
   単一HTMLファイル / 外部通信なし / データは手元のみ
   ========================================================= */

const BUILD = "2026-08-12a";
const KEY = "minamo.gtd.v1";
const STATES = {
  inbox:    {t:"収集トレイ", g:"◇", sub:"まだ意味づけしていないもの"},
  next:     {t:"次のアクション", g:"→", sub:"すぐ着手できる具体的な一手"},
  waiting:  {t:"待ち", g:"…", sub:"人に預けて返事を待っているもの"},
  calendar: {t:"カレンダー", g:"▣", sub:"その日でなければ意味がないもの"},
  someday:  {t:"いつか / たぶん", g:"○", sub:"今はやらないが、捨てたくないもの"},
  reference:{t:"資料", g:"▤", sub:"行動は不要。参照するだけのもの"},
  done:     {t:"完了", g:"✓", sub:"片づいたもの"}
};
const MIN_OPT = [[0,"—"],[5,"5分"],[15,"15分"],[30,"30分"],[60,"1時間"],[120,"2時間+"]];
const CYCLES = {daily:"毎日", weekly:"毎週", monthly:"毎月", adhoc:"随時"};
const WD = ["日","月","火","水","木","金","土"];

let db, ui = {view:"inbox", sel:null, clar:null, ctx:null, min:0, energy:"", q:"",
  review:null, storeOK:true, tplDraft:null, flash:null};
