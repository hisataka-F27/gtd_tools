function blank(){
  return {version:1, appName:"みなも", appTag:"MIND LIKE WATER", items:[], projects:[], templates:[],
    contexts:["@PC","@電話","@外出","@打合せ","@自宅"],
    review:{last:null, history:[]}};
}

function normalize(){
  if(!db.contexts) db.contexts = blank().contexts;
  if(!db.projects) db.projects = [];
  if(!db.review) db.review = {last:null, history:[]};
  if(!db.templates) db.templates = [];
  if(!db.appName) db.appName = "みなも";
  if(db.appTag == null) db.appTag = "MIND LIKE WATER";
}

const item = id => db.items.find(i => i.id===id);
const prj  = id => db.projects.find(p => p.id===id);

function newItem(title){
  return {id:uid(), title:title, note:"", state:"inbox", context:"", project:null, due:null,
    who:"", since:null, minutes:0, energy:"", created:today(), updated:today(), doneAt:null};
}


function blankTpl(){
  return {id:null, title:"", note:"", context:"", minutes:0, energy:"", project:null,
    target:"next", cycle:"daily", weekdays:[1], monthday:1, lastRun:null};
}
