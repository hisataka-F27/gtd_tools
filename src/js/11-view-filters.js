/* =========================================================
   描画：絞り込み
   ========================================================= */
function renderFilters(){
  const box = $("#filters");
  if(ui.view==="routines"){ box.style.display = "none"; box.innerHTML = ""; return; }
  box.style.display = "";
  if(ui.view!=="next" && !ui.view.startsWith("ctx:")){
    box.innerHTML = `<span class="chip-label">SEARCH</span>
      <input class="search" id="qIn" placeholder="本文・PRJ名・相手" value="${esc(ui.q)}">`;
    box.style.justifyContent = "flex-end";
  }else{
    box.style.justifyContent = "";
    box.innerHTML = `<span class="chip-label">TIME</span>` +
      MIN_OPT.map(([m,l]) => `<button class="chip ${ui.min===m?"on":""}" data-min="${m}">${m?("〜"+l):"すべて"}</button>`).join("") +
      `<span class="chip-label" style="margin-left:10px">ENERGY</span>` +
      [["","すべて"],["high","高い"],["low","低い"]].map(([v,l]) =>
        `<button class="chip ${ui.energy===v?"on":""}" data-energy="${v}">${l}</button>`).join("") +
      `<input class="search" id="qIn" placeholder="本文・PRJ名・相手" value="${esc(ui.q)}">`;
  }
}
