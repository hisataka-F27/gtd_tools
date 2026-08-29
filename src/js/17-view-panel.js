function renderPanel(){
  if(!ui.sel) return;
  if(ui.sel==="__tpl__"){ renderTplForm(); return; }
  if(ui.sel==="__settings__") renderSettings();
  else if(ui.clar) renderClarify();
  else if(prj(ui.sel)) renderPrjEdit();
  else renderEdit();
}
function showPanel(){ $("#panel").classList.remove("closed"); }
function closePanel(){ ui.sel = null; ui.clar = null; ui.tplDraft = null; $("#panel").classList.add("closed"); $("#pBody").innerHTML = ""; $("#pTitle").textContent = "選択なし"; }
