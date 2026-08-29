/* =========================================================
   描画：絞り込み
   ========================================================= */
function renderFilters(){
  const box = $("#filters");
  if(ui.view==="routines"){ box.style.display = "none"; box.innerHTML = ""; return; }
  box.style.display = "";
  if(ui.view!=="next" && !ui.view.startsWith("ctx:")){
    box.innerHTML = html`<span class="chip-label">SEARCH</span>
      <input class="search" id="qIn" placeholder="本文・PRJ名・相手" value="${ui.q}">`;
    box.style.justifyContent = "flex-end";
  }else{
    box.style.justifyContent = "";
    /* 配列で渡す部分HTML片は、html`` の結果をそのまま渡すと二重エスケープになるため
       raw() で包む（html`` 自体は内部で埋め込み値を正しくエスケープ済みなので安全）。 */
    const minChips = MIN_OPT.map(([m,l]) =>
      raw(html`<button class="chip ${ui.min===m?"on":""}" data-min="${m}">${m?("〜"+l):"すべて"}</button>`));
    const energyChips = [["","すべて"],["high","高い"],["low","低い"]].map(([v,l]) =>
      raw(html`<button class="chip ${ui.energy===v?"on":""}" data-energy="${v}">${l}</button>`));
    box.innerHTML = html`<span class="chip-label">TIME</span>${minChips}<span class="chip-label" style="margin-left:10px">ENERGY</span>${energyChips}<input class="search" id="qIn" placeholder="本文・PRJ名・相手" value="${ui.q}">`;
  }
}
