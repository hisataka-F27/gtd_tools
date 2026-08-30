/* =========================================================
   イベント配線 — セレクタ/条件 → アクション のルーティング表

   旧 click / input / change ×2 / keydown ハンドラは、約30個の if を
   上から順に評価し、最初に一致したものだけを実行して return していた。
   ここではその評価順序を1行もずらさず配列の並びとして写し、
   最初に一致したエントリだけを実行して打ち切る（旧 return と同義）。

   - `match(t)` は一致した要素（またはイベント）を返す。不一致なら falsy。
   - `stop:true` は旧コードの `e.stopPropagation()` に対応する
     （[data-tpledit] と [data-tick] の2箇所のみ）。
   - closest() によるマッチと t.id===/dataset 直接参照によるマッチが
     混在するため、match は「そのつど判定してマッチ対象を返す関数」にしている。
   ========================================================= */

function runRoutes(routes, e){
  for(const r of routes){
    const m = r.match(e);
    if(m){
      if(r.stop) e.stopPropagation();
      r.run(m, e);
      return true;
    }
  }
  return false;
}

const CLICK_ROUTES = [
  { match: e => e.target.closest("[data-open]"),
    run: () => openSettings() },

  { match: e => e.target.closest("[data-cmove]"),
    run: el => moveContext(+el.dataset.cmove, +el.dataset.dir) },

  { match: e => e.target.closest("[data-cdel]"),
    run: el => deleteContext(+el.dataset.cdel) },

  { match: e => e.target.id==="appSave" ? e.target : null,
    run: () => saveAppName($("#appName").value.trim(), $("#appTag").value.trim()) },

  { match: e => e.target.id==="bakRestore" ? e.target : null,
    run: () => restoreBackup() },

  /* ---- 定型 ---- */
  { match: e => e.target.closest("[data-tpledit]"), stop: true,
    run: el => openTemplateEditor(el.dataset.tpledit) },

  { match: e => e.target.closest("[data-tplrun]"),
    run: el => runTemplate(el.dataset.tplrun) },

  { match: e => e.target.id==="tplAllRun" ? e.target : null,
    run: () => runAllPendingTemplates() },

  { match: e => e.target.id==="tplNew" ? e.target : null,
    run: () => newTemplate() },

  { match: e => e.target.closest("[data-wd]"),
    run: el => toggleTemplateWeekday(+el.dataset.wd) },

  { match: e => (e.target.id==="tSave" || e.target.id==="tSaveRun") ? e.target : null,
    run: t => saveTemplate({run: t.id==="tSaveRun"}) },

  { match: e => e.target.id==="tDel" ? e.target : null,
    run: () => deleteTemplate() },

  { match: e => e.target.id==="eTpl" ? e.target : null,
    run: () => makeTemplateFromItem(ui.sel) },

  { match: e => e.target.closest("[data-view]"),
    run: el => switchView(el.dataset.view) },

  { match: e => e.target.closest("[data-tick]"), stop: true,
    run: el => toggleItemDone(el.dataset.tick) },

  { match: e => e.target.closest("[data-id]"),
    run: el => selectItem(el.dataset.id) },

  { match: e => e.target.closest("[data-prj]"),
    run: el => selectProject(el.dataset.prj) },

  { match: e => e.target.closest("[data-min]"),
    run: el => setMinutesFilter(+el.dataset.min) },
  { match: e => e.target.closest("[data-energy]"),
    run: el => setEnergyFilter(el.dataset.energy) },

  { match: e => e.target.closest("[data-opt]"),
    run: el => chooseClarifyOption(+el.dataset.opt) },

  { match: e => e.target.id==="fSave" ? e.target : null,
    run: () => submitClarify() },
  { match: e => e.target.id==="fBack" ? e.target : null,
    run: () => backClarify() },
  { match: e => e.target.id==="clarRestart" ? e.target : null,
    run: () => restartClarify() },
  { match: e => e.target.id==="clarEdit" ? e.target : null,
    run: () => cancelClarify() },
  { match: e => e.target.id==="pClose" ? e.target : null,
    run: () => closePanelView() },

  /* 項目編集 */
  { match: e => e.target.id==="eSave" ? e.target : null,
    run: () => saveItemEdit() },
  { match: e => e.target.id==="eDone" ? e.target : null,
    run: () => completeItem() },
  { match: e => e.target.id==="eReopen" ? e.target : null,
    run: () => reopenItem() },
  { match: e => e.target.id==="eClar" ? e.target : null,
    run: () => startClarify() },
  { match: e => e.target.id==="eDel" ? e.target : null,
    run: () => deleteItem() },

  /* プロジェクト編集 */
  { match: e => e.target.id==="pSave" ? e.target : null,
    run: () => saveProject() },
  { match: e => e.target.id==="pDone" ? e.target : null,
    run: () => completeProject() },
  { match: e => e.target.id==="pDel" ? e.target : null,
    run: () => deleteProject() },

  /* 上部バー */
  { match: e => e.target.id==="btnExport" ? e.target : null,
    run: () => exportJSON() },
  { match: e => e.target.id==="btnImport" ? e.target : null,
    run: () => promptImport() },
  { match: e => e.target.id==="btnReview" ? e.target : null,
    run: () => openReview() },

  /* レビュー */
  { match: e => e.target.closest('[data-rv="next"]'),
    run: () => reviewNext() },
  { match: e => e.target.closest('[data-rv="prev"]'),
    run: () => reviewPrev() },
  { match: e => e.target.closest('[data-rv="close"]'),
    run: () => reviewClose() },
  { match: e => e.target.closest('[data-rv="jump"]'),
    run: () => reviewJump() },
  { match: e => e.target.closest('[data-rv="finish"]'),
    run: () => reviewFinish() },

  { match: e => e.target.closest("[data-rvopen]"),
    run: el => openFromReview(el.dataset.rvopen, el.dataset.rvp==="1") },

  { match: e => (e.target.dataset && e.target.dataset.ovbg) ? e.target : null,
    run: () => closeReviewOverlay() }
];

const INPUT_ROUTES = [
  { match: e => e.target.id==="qIn" ? e.target : null,
    run: (el, e) => setSearchQuery(e.target.value) }
];

/* 周期を変えたら、曜日・日にちの欄を出し分けるために描き直す */
const TPL_FORM_CHANGE_ROUTES = [
  { match: e => (e.target.id==="tCycle" && ui.tplDraft) ? e.target : null,
    run: () => changeTemplateCycle() }
];

/* コンテキスト名の変更：使用中の行動をまとめて追従させる */
const CTX_CHANGE_ROUTES = [
  { match: e => (e.target.classList && e.target.classList.contains("ctx-in")) ? e.target : null,
    run: el => renameContext(el, +el.dataset.cix) }
];

const KEYDOWN_ROUTES = [
  { match: e => (e.target.id==="ctxNew" && isSubmitEnter(e)) ? e.target : null,
    run: el => addContextNew(el) },

  { match: e => (e.target.id==="pAdd" && isSubmitEnter(e)) ? e.target : null,
    run: el => addProjectAction(el) },

  { match: e => {
      const card = e.target.closest && e.target.closest("[data-tplrun]");
      return (card && (e.key==="Enter" || e.key===" ")) ? card : null;
    },
    run: (card, e) => triggerTemplateCardClick(e, card) },

  { match: e => e.key==="Escape" ? e.target : null,
    run: () => dismissActive() },

  { match: e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      return (!typing && e.key==="n") ? e.target : null;
    },
    run: (el, e) => focusCapture(e) },

  { match: e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      return (!typing && e.key==="/") ? e.target : null;
    },
    run: (el, e) => focusSearch(e) }
];

/* ---- TEST EXPORTS (build.js strips this) ---- */
if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, {
  runRoutes, CLICK_ROUTES, INPUT_ROUTES, TPL_FORM_CHANGE_ROUTES, CTX_CHANGE_ROUTES, KEYDOWN_ROUTES
});
