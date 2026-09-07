const STORAGE_KEY="gaggu_budget_v2";
const DB_NAME="gaggu_photo_db_v1";
const DB_STORE="photos";
const defaultCategories=[
  {name:"식비",emoji:"🍚",type:"expense"},{name:"카페",emoji:"☕",type:"expense"},{name:"교통",emoji:"🚌",type:"expense"},
  {name:"쇼핑",emoji:"🛍️",type:"expense"},{name:"생활",emoji:"🧺",type:"expense"},{name:"고정비",emoji:"🏠",type:"expense"},
  {name:"의료",emoji:"💊",type:"expense"},{name:"여가",emoji:"🎬",type:"expense"},{name:"교육",emoji:"📚",type:"expense"},
  {name:"육아",emoji:"🧸",type:"expense"},{name:"반려동물",emoji:"🐶",type:"expense"},{name:"미용",emoji:"💇",type:"expense"},
  {name:"여행",emoji:"✈️",type:"expense"},{name:"경조사",emoji:"🎁",type:"expense"},{name:"보험",emoji:"🛡️",type:"expense"},
  {name:"세금",emoji:"🧾",type:"expense"},{name:"대출",emoji:"🏦",type:"expense"},{name:"기타지출",emoji:"✨",type:"expense"},
  {name:"급여",emoji:"💰",type:"income"},{name:"부수입",emoji:"💻",type:"income"},{name:"용돈",emoji:"💌",type:"income"},
  {name:"상여금",emoji:"🎉",type:"income"},{name:"환급",emoji:"↩️",type:"income"},{name:"이자",emoji:"🌱",type:"income"},
  {name:"중고판매",emoji:"📦",type:"income"},{name:"기타수입",emoji:"🪙",type:"income"}
];
const state=loadState();
let viewDate=new Date();viewDate.setDate(1);
let selectedDate=isoDate(new Date());
let activePhotoId=null;
const $=id=>document.getElementById(id);

function loadState(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    const s=raw?JSON.parse(raw):{};
    return {
      records:Array.isArray(s.records)?s.records:[],
      monthlyBudget:s.monthlyBudget||{},
      fixed:Array.isArray(s.fixed)?s.fixed:[],
      theme:s.theme||"cream",
      calendarStyle:s.calendarStyle||"soft",
      customColors:s.customColors||null,
      categories:Array.isArray(s.categories)&&s.categories.length?s.categories:structuredClone(defaultCategories),
      goals:Array.isArray(s.goals)?s.goals:[], subscriptions:Array.isArray(s.subscriptions)?s.subscriptions:[], categoryBudgets:s.categoryBudgets||{}, selectedYear:s.selectedYear||new Date().getFullYear(), savings:Array.isArray(s.savings)?s.savings:[], savingGoals:Array.isArray(s.savingGoals)?s.savingGoals:[]
    };
  }catch{
    return {records:[],monthlyBudget:{},fixed:[],theme:"cream",calendarStyle:"soft",customColors:null,categories:structuredClone(defaultCategories),goals:[],subscriptions:[],categoryBudgets:{},selectedYear:new Date().getFullYear(),savings:[],savingGoals:[]};
  }
}

if(Array.isArray(state.goals)&&state.goals.length && Array.isArray(state.savingGoals)){
  const existingNames=new Set(state.savingGoals.map(g=>g.name));
  let migrated=false;
  for(const g of state.goals){
    if(existingNames.has(g.name)) continue;
    const start=isoDate(new Date());
    let end=g.date||"";
    if(!end){const d=new Date();d.setMonth(d.getMonth()+6);end=isoDate(d);}
    state.savingGoals.push({id:g.id||uid(),name:g.name||"저축 목표",target:Number(g.target||0),start,end,createdAt:Date.now()});
    if(Number(g.current||0)>0){
      state.savings.push({id:uid(),type:"deposit",name:g.name||"저축",amount:Number(g.current),date:start,goalId:g.id||"",memo:"기존 저축 목표에서 자동 이전",createdAt:Date.now()});
    }
    migrated=true;
  }
  if(migrated){state.goals=[];localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}
}

state.categories=state.categories.map(c=>({...c,type:c.type||(["급여","부수입","용돈","상여금","환급","이자","중고판매","기타수입"].includes(c.name)?"income":"expense")}));
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function monthKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`}
function money(n){return new Intl.NumberFormat("ko-KR").format(Math.round(Number(n||0)))+"원"}
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]))}
function recordsForDate(date){return state.records.filter(r=>r.date===date)}
function totals(rs){let income=0,expense=0;for(const r of rs){if(r.type==="income")income+=Number(r.amount||0);else expense+=Number(r.amount||0)}return {income,expense,balance:income-expense}}
function catInfo(name){return state.categories.find(c=>c.name===name)||{name,emoji:"✨"}}
function uid(){return crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random()}

function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(DB_STORE)){const st=db.createObjectStore(DB_STORE,{keyPath:"id"});st.createIndex("date","date",{unique:false})}};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
async function addPhotoRecord(rec){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).put(rec);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function getPhotosByDate(date){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readonly");const idx=tx.objectStore(DB_STORE).index("date");const req=idx.getAll(IDBKeyRange.only(date));req.onsuccess=()=>res(req.result||[]);req.onerror=()=>rej(req.error)})}
async function deletePhotoRecord(id){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readwrite");tx.objectStore(DB_STORE).delete(id);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function photoCountsForDates(dates){
  const wanted=new Set(dates),out={};
  dates.forEach(d=>out[d]=0);
  try{
    const db=await openDB();
    const all=await new Promise((res,rej)=>{
      const req=db.transaction(DB_STORE,"readonly").objectStore(DB_STORE).getAll();
      req.onsuccess=()=>res(req.result||[]);
      req.onerror=()=>rej(req.error);
    });
    for(const p of all){if(wanted.has(p.date))out[p.date]=(out[p.date]||0)+1;}
  }catch(e){console.warn("photo count",e);}
  return out;
}
function compressImage(file,maxSize=1400,quality=.78){
  return new Promise((resolve,reject)=>{
    const img=new Image();const url=URL.createObjectURL(file);
    img.onload=()=>{
      let w=img.width,h=img.height;const scale=Math.min(1,maxSize/Math.max(w,h));w=Math.round(w*scale);h=Math.round(h*scale);
      const c=document.createElement("canvas");c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);
      c.toBlob(blob=>{URL.revokeObjectURL(url);blob?resolve(blob):reject(new Error("압축 실패"))},"image/jpeg",quality);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("이미지 읽기 실패"))};img.src=url;
  });
}

function applyTheme(){
  document.body.dataset.theme=state.theme;
  document.body.dataset.calendarStyle=state.calendarStyle;
  if(state.customColors){
    const r=document.documentElement.style;
    r.setProperty("--bg",state.customColors.bg);
    r.setProperty("--accent",state.customColors.accent);
    r.setProperty("--card",state.customColors.card);
  }else{
    document.documentElement.style.removeProperty("--bg");
    document.documentElement.style.removeProperty("--accent");
    document.documentElement.style.removeProperty("--card");
  }
}
function categoriesByType(type){
  return state.categories.filter(c=>(c.type||(["급여","부수입","용돈","상여금","환급","이자","중고판매","기타수입"].includes(c.name)?"income":"expense"))===type);
}
function renderCategoryQuickPick(){
  if(!$("categoryQuickPick"))return;
  const type=document.querySelector('input[name="type"]:checked')?.value||"expense";
  const list=categoriesByType(type);
  if(!list.some(c=>c.name===$("category").value)) $("category").value=list[0]?.name||"";
  $("categoryQuickPick").innerHTML=list.map(c=>`<button type="button" class="cat-chip ${$("category").value===c.name?"active":""}" data-pick-category="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</button>`).join("");
}
function populateCategories(){
  const type=document.querySelector('input[name="type"]:checked')?.value||"expense";
  const list=categoriesByType(type);
  $("category").innerHTML=list.map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join("");
  const expenseHtml=categoriesByType("expense").map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join("");
  $("fixedCategory").innerHTML=expenseHtml;if($("subscriptionCategory"))$("subscriptionCategory").innerHTML=expenseHtml;if($("quickCategory"))$("quickCategory").innerHTML=expenseHtml;
  $("emojiEditor").innerHTML=state.categories.map((c,i)=>`<div class="emoji-row"><strong>${esc(c.name)}</strong><input data-emoji-index="${i}" value="${esc(c.emoji)}" maxlength="4"></div>`).join("");
  renderCategoryQuickPick();
}
async function render(){
  applyTheme();populateCategories();
  await renderCalendar();renderSelectedDay();renderMonthSummary();renderMonthRecords();ensureRecurringForMonth();renderBudget();renderFixed();renderStats();renderReport();renderSubscriptions();renderYearly();renderSavings();renderBudgetWarning();await renderPhotos();
}
async function renderCalendar(){
  const y=viewDate.getFullYear(),m=viewDate.getMonth();
  $("monthTitle").textContent=`${y}년 ${m+1}월`;
  const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),today=isoDate(new Date()),cal=$("calendar");
  const dates=[];
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);dates.push(isoDate(d))}
  const photoCounts=await photoCountsForDates(dates);
  const frag=document.createDocumentFragment();
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);
    const date=isoDate(d),rs=recordsForDate(date),t=totals(rs),pc=photoCounts[date]||0;
    const el=document.createElement("button");
    el.type="button";el.className="day";
    if(d.getMonth()!==m)el.classList.add("other");
    if(date===selectedDate)el.classList.add("selected");
    if(date===today)el.classList.add("today");
    el.innerHTML=`<span class="day-num">${d.getDate()}</span><div class="day-money">${t.expense?`<div class="day-expense">-${money(t.expense)}</div>`:""}${t.income?`<div class="day-income">+${money(t.income)}</div>`:""}${pc?`<span class="photo-count">📷 ${pc}</span>`:""}</div>`;
    el.onclick=async()=>{
      const monthChanged=d.getMonth()!==viewDate.getMonth()||d.getFullYear()!==viewDate.getFullYear();
      selectedDate=date;
      if(monthChanged){
        viewDate=new Date(d.getFullYear(),d.getMonth(),1);
        await render();
      }else{
        cal.querySelectorAll(".day.selected").forEach(x=>x.classList.remove("selected"));
        el.classList.add("selected");
        renderSelectedDay();
        renderMonthSummary();
        renderBudgetWarning();
        await renderPhotos();
      }
    };
    frag.appendChild(el);
  }
  cal.replaceChildren(frag);
}
function renderSelectedDay(){
  const d=new Date(selectedDate+"T00:00:00");$("selectedDateTitle").textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  const rs=recordsForDate(selectedDate).sort((a,b)=>b.createdAt-a.createdAt),t=totals(rs);$("selectedDayTotal").textContent=`지출 ${money(t.expense)} · 수입 ${money(t.income)}`;
  $("records").innerHTML=rs.length?rs.map(r=>`<article class="record"><div><b>${esc(catInfo(r.category).emoji)} ${esc(r.category)} · ${esc(r.description||"내용 없음")}</b><div class="record-meta">${esc(r.payment||"-")}${r.memo?" · "+esc(r.memo):""}</div></div><div class="record-amount ${r.type}">${r.type==="income"?"+":"-"}${money(r.amount)}</div><div class="record-actions"><button class="edit-btn" onclick="openEditRecord('${r.id}')">수정</button><button class="delete-btn" onclick="deleteRecord('${r.id}')">삭제</button></div></article>`).join(""):'<div class="empty">아직 기록이 없어요.</div>';
}
function renderMonthSummary(){
  const rs=state.records.filter(r=>r.date.startsWith(monthKey(viewDate))),t=totals(rs),budget=Number(state.monthlyBudget[monthKey(viewDate)]||0);
  $("incomeTotal").textContent=money(t.income);$("expenseTotal").textContent=money(t.expense);$("balanceTotal").textContent=money(t.balance);$("budgetRemain").textContent=budget?money(Math.max(0,budget-t.expense)):"미설정";
}
function renderMonthRecords(){
  const mk=monthKey(viewDate),q=$("searchInput").value.trim().toLowerCase();
  const rs=state.records.filter(r=>r.date.startsWith(mk)).filter(r=>!q||[r.category,r.description,r.payment,r.memo].some(v=>String(v||"").toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  $("monthRecords").innerHTML=rs.length?rs.map(r=>`<article class="record"><div><b>${esc(r.date)} · ${esc(catInfo(r.category).emoji)} ${esc(r.category)} · ${esc(r.description||"내용 없음")}</b><div class="record-meta">${esc(r.payment||"-")}${r.memo?" · "+esc(r.memo):""}</div></div><div class="record-amount ${r.type}">${r.type==="income"?"+":"-"}${money(r.amount)}</div><div class="record-actions"><button class="edit-btn" onclick="openEditRecord('${r.id}')">수정</button><button class="delete-btn" onclick="deleteRecord('${r.id}')">삭제</button></div></article>`).join(""):'<div class="empty">이번 달 기록이 없습니다.</div>';
}

function getBudgetWarnings(){
  const mk=monthKey(viewDate),cb=state.categoryBudgets[mk]||{},by={};
  state.records.filter(r=>r.type==="expense"&&r.date.startsWith(mk)).forEach(r=>by[r.category]=(by[r.category]||0)+Number(r.amount||0));
  const warnings=[];
  for(const [cat,budgetRaw] of Object.entries(cb)){
    const budget=Number(budgetRaw||0);if(!budget)continue;
    const spent=Number(by[cat]||0),pct=Math.round(spent/budget*100);
    if(pct>=80)warnings.push({cat,spent,budget,pct,level:pct>=100?"over":"warning"});
  }
  return warnings.sort((a,b)=>b.pct-a.pct);
}
function renderBudgetWarning(){
  if(!$("budgetAlertBanner"))return;
  const ws=getBudgetWarnings();
  if(!ws.length){$("budgetAlertBanner").className="budget-alert hidden";$("budgetAlertBanner").innerHTML="";return;}
  const top=ws[0];$("budgetAlertBanner").className=`budget-alert ${top.level}`;
  $("budgetAlertBanner").innerHTML=top.level==="over"
    ? `🚨 ${esc(catInfo(top.cat).emoji)} ${esc(top.cat)} 예산을 ${top.pct}% 사용했어요. 예산을 초과했어요!`
    : `⚠️ ${esc(catInfo(top.cat).emoji)} ${esc(top.cat)} 예산을 ${top.pct}% 사용했어요. 조금만 주의해 주세요.`;
}
function maybeShowBudgetAlert(category){
  const w=getBudgetWarnings().find(x=>x.cat===category);if(!w)return;
  const key=`gaggu_warn_${monthKey(viewDate)}_${category}_${w.level}`;
  if(sessionStorage.getItem(key))return;
  sessionStorage.setItem(key,"1");
  alert(w.level==="over"
    ? `🚨 ${catInfo(category).emoji} ${category} 예산 초과\n\n${w.pct}% 사용했어요.\n지출 ${money(w.spent)} / 예산 ${money(w.budget)}`
    : `⚠️ ${catInfo(category).emoji} ${category} 예산 주의\n\n${w.pct}% 사용했어요.\n지출 ${money(w.spent)} / 예산 ${money(w.budget)}`);
}
function renderBudget(){
  const mk=monthKey(viewDate),budget=Number(state.monthlyBudget[mk]||0),rs=state.records.filter(r=>r.date.startsWith(mk)&&r.type==="expense"),spent=totals(rs).expense,remain=Math.max(0,budget-spent),pct=budget?Math.min(100,(spent/budget)*100):0;
  $("monthlyBudget").value=budget||"";$("budgetPercent").textContent=`${Math.round(pct)}%`;$("budgetProgress").style.width=pct+"%";$("budgetMetric").textContent=money(budget);$("spentMetric").textContent=money(spent);$("remainMetric").textContent=money(remain);
  const by={};for(const r of rs)by[r.category]=(by[r.category]||0)+Number(r.amount||0);const max=Math.max(1,...Object.values(by));
  const cb=state.categoryBudgets[mk]||{};
  if($("categoryBudgetEditor")){
    $("categoryBudgetEditor").innerHTML=state.categories.filter(c=>!["급여","용돈"].includes(c.name)).map(c=>`<div class="cat-budget-item"><label>${esc(c.emoji)} ${esc(c.name)}</label><input type="number" inputmode="numeric" min="0" data-cat-budget="${esc(c.name)}" value="${Number(cb[c.name]||0)||""}" placeholder="예산"></div>`).join("");
  }
  $("categoryBudgetList").innerHTML=state.categories.filter(c=>!["급여","용돈"].includes(c.name)).map(c=>{
    const v=Number(by[c.name]||0),b=Number(cb[c.name]||0),pct=b?Math.round(v/b*100):0,cls=b&&pct>=100?"over":b&&pct>=80?"warning":"";
    const width=b?Math.min(100,pct):v/max*100;
    const status=!b?"예산 미설정":pct>=100?`초과 ${pct}%`:pct>=80?`주의 ${pct}%`:`${pct}%`;
    return `<div class="bar-row ${cls}"><span class="bar-name">${esc(c.emoji)} ${esc(c.name)}</span><div><div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div><span class="bar-status ${cls}">${status}</span></div><span class="bar-value">${money(v)}${b?` / ${money(b)}`:""}</span></div>`;
  }).join("");
}
function renderFixed(){
  $("fixedList").innerHTML=state.fixed.length?state.fixed.map(f=>`<article class="fixed-item"><div><b>${esc(catInfo(f.category).emoji)} ${esc(f.name)} <span class="status-chip ${f.ended?"ended":"active"}">${f.ended?"해지":"사용중"}</span></b><div class="record-meta">매월 ${f.day}일 · ${esc(f.category)}${f.memo?" · "+esc(f.memo):""}${!f.ended?" · 자동반영":""}</div></div><strong>${money(f.amount)}</strong><div class="record-actions">${!f.ended?`<button class="end-btn" onclick="endFixed('${f.id}')">해지</button>`:""}<button class="delete-btn" onclick="deleteFixed('${f.id}')">삭제</button></div></article>`).join(""):'<div class="empty">등록된 고정비가 없어요.</div>';
}
function renderStats(){
  const mk=monthKey(viewDate),rs=state.records.filter(r=>r.date.startsWith(mk)),t=totals(rs),saveRate=t.income?Math.max(0,Math.round((t.balance/t.income)*100)):0;$("statIncome").textContent=money(t.income);$("statExpense").textContent=money(t.expense);$("savingRate").textContent=saveRate+"%";
  const by={};for(const r of rs.filter(r=>r.type==="expense"))by[r.category]=(by[r.category]||0)+Number(r.amount||0);const max=Math.max(1,...Object.values(by));
  $("statBars").innerHTML=Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span class="bar-name">${esc(catInfo(k).emoji)} ${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-value">${money(v)}</span></div>`).join(""):'<div class="empty">통계를 만들 지출 기록이 없어요.</div>';
}
async function renderPhotos(){
  const photos=await getPhotosByDate(selectedDate);$("photoGrid").innerHTML=photos.length?photos.map(p=>`<button class="photo-thumb" onclick="openPhoto('${p.id}')"><img src="${URL.createObjectURL(p.blob)}"></button>`).join(""):'<div class="empty" style="grid-column:1/-1">사진을 추가하면 여기에 모여요.</div>';
}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-pick-category]");
  if(!b)return;
  $("category").value=b.dataset.pickCategory;
  renderCategoryQuickPick();
});
document.querySelectorAll('input[name="type"]').forEach(r=>r.addEventListener("change",()=>{
  populateCategories();
}));

$("entryForm").addEventListener("submit",e=>{e.preventDefault();const amount=Number($("amount").value);if(!amount||amount<=0)return alert("금액을 입력해 주세요.");const type=document.querySelector('input[name="type"]:checked').value;state.records.push({id:uid(),date:selectedDate,type,category:$("category").value,description:$("description").value.trim(),amount,payment:$("payment").value,memo:$("memo").value.trim(),createdAt:Date.now()});saveState();const savedCategory=$("category").value;$("description").value="";$("amount").value="";$("memo").value="";render().then(()=>maybeShowBudgetAlert(savedCategory))});

let editingRecordId=null;

function populateEditCategories(type,selected){
  const list=categoriesByType(type);
  $("editCategory").innerHTML=list.map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join("");
  if(selected && list.some(c=>c.name===selected)) $("editCategory").value=selected;
}

function openEditRecord(id){
  const r=state.records.find(x=>x.id===id);
  if(!r)return;
  editingRecordId=id;
  document.querySelectorAll('input[name="editType"]').forEach(el=>el.checked=el.value===r.type);
  populateEditCategories(r.type,r.category);
  $("editDate").value=r.date;
  $("editDescription").value=r.description||"";
  $("editAmount").value=r.amount||"";
  $("editPayment").value=[...$("editPayment").options].some(o=>o.value===r.payment)?r.payment:"기타";
  $("editMemo").value=r.memo||"";
  $("editRecordModal").classList.remove("hidden");
}
window.openEditRecord=openEditRecord;

document.querySelectorAll('input[name="editType"]').forEach(el=>{
  el.addEventListener("change",()=>{
    const current=$("editCategory").value;
    populateEditCategories(el.value,current);
  });
});

if($("closeEditRecordBtn"))$("closeEditRecordBtn").onclick=()=>{
  editingRecordId=null;
  $("editRecordModal").classList.add("hidden");
};

if($("editRecordForm"))$("editRecordForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const r=state.records.find(x=>x.id===editingRecordId);
  if(!r)return;
  const amount=Number($("editAmount").value);
  if(!amount||amount<=0)return alert("금액을 입력해 주세요.");
  const type=document.querySelector('input[name="editType"]:checked')?.value||"expense";

  r.type=type;
  r.date=$("editDate").value||r.date;
  r.category=$("editCategory").value;
  r.description=$("editDescription").value.trim();
  r.amount=amount;
  r.payment=$("editPayment").value;
  r.memo=$("editMemo").value.trim();
  r.updatedAt=Date.now();

  saveState();
  selectedDate=r.date;
  const d=new Date(r.date+"T00:00:00");
  viewDate=new Date(d.getFullYear(),d.getMonth(),1);
  editingRecordId=null;
  $("editRecordModal").classList.add("hidden");
  await render();
  maybeShowBudgetAlert(r.category);
  showToast("기록을 수정했어요 ♡");
});

function deleteRecord(id){const i=state.records.findIndex(r=>r.id===id);if(i<0||!confirm("이 기록을 삭제할까요?"))return;state.records.splice(i,1);saveState();render()}window.deleteRecord=deleteRecord;
$("clearDayBtn").onclick=()=>{const rs=recordsForDate(selectedDate);if(!rs.length)return;if(!confirm("이날 기록을 모두 삭제할까요?"))return;state.records=state.records.filter(r=>r.date!==selectedDate);saveState();render()};
$("prevMonth").onclick=()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);render()};$("nextMonth").onclick=()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);render()};$("todayBtn").onclick=()=>{const n=new Date();viewDate=new Date(n.getFullYear(),n.getMonth(),1);selectedDate=isoDate(n);render()};
$("searchInput").oninput=renderMonthRecords;
$("saveBudgetBtn").onclick=()=>{state.monthlyBudget[monthKey(viewDate)]=Number($("monthlyBudget").value||0);saveState();render()};
$("fixedForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("fixedAmount").value),day=Number($("fixedDay").value),name=$("fixedName").value.trim();
  if(!name||!amount||!day)return alert("이름, 금액, 결제일을 입력해 주세요.");
  const f={id:uid(),name,amount,day,category:$("fixedCategory").value,memo:$("fixedMemo").value.trim(),auto:true,ended:false};
  state.fixed.push(f);
  saveState();
  applyFixedForMonth(f,viewDate);
  e.target.reset();
  if($("fixedAuto"))$("fixedAuto").checked=true;
  populateCategories();render();showToast("고정비가 저장되고 이번 달 달력에 반영됐어요 ♡");
});

function applyFixedForMonth(f,d){
  if(!f||f.ended)return;
  const mk=monthKey(d);
  if(state.records.some(r=>r.fixedId===f.id&&r.date.startsWith(mk)))return;
  const y=d.getFullYear(),m=d.getMonth(),day=Math.min(Number(f.day||1),new Date(y,m+1,0).getDate());
  const date=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  state.records.push({id:uid(),fixedId:f.id,date,type:"expense",category:f.category,description:f.name,amount:Number(f.amount||0),payment:"자동",memo:f.memo||"고정비",createdAt:Date.now()});
  saveState();
}
function endFixed(id){
  const f=state.fixed.find(x=>x.id===id);if(!f)return;
  if(!confirm(`${f.name} 고정비를 해지할까요?\n이미 기록된 과거 지출은 그대로 유지됩니다.`))return;
  f.ended=true;f.auto=false;f.endedAt=isoDate(new Date());saveState();render();showToast("고정비를 해지했어요.");
}window.endFixed=endFixed;

function deleteFixed(id){if(!confirm("이 고정비를 삭제할까요?"))return;state.fixed=state.fixed.filter(f=>f.id!==id);saveState();renderFixed()}window.deleteFixed=deleteFixed;

$("photoInput").onchange=async e=>{const files=[...(e.target.files||[])];for(const file of files){try{const blob=await compressImage(file);await addPhotoRecord({id:uid(),date:selectedDate,blob,createdAt:Date.now()})}catch(err){console.error(err)}}e.target.value="";await render()};
async function openPhoto(id){const db=await openDB();const rec=await new Promise((res,rej)=>{const req=db.transaction(DB_STORE,"readonly").objectStore(DB_STORE).get(id);req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});if(!rec)return;activePhotoId=id;$("viewerImage").src=URL.createObjectURL(rec.blob);$("photoViewer").classList.remove("hidden")}window.openPhoto=openPhoto;
$("closeViewerBtn").onclick=()=>$("photoViewer").classList.add("hidden");$("deletePhotoBtn").onclick=async()=>{if(!activePhotoId||!confirm("이 사진을 삭제할까요?"))return;await deletePhotoRecord(activePhotoId);activePhotoId=null;$("photoViewer").classList.add("hidden");await render()};
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));
  document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+btn.dataset.tab));
  if(btn.dataset.tab==="budget")renderBudget();
  else if(btn.dataset.tab==="fixed")renderFixed();
  else if(btn.dataset.tab==="stats")renderStats();
  else if(btn.dataset.tab==="report")renderReport();
  else if(btn.dataset.tab==="subscriptions")renderSubscriptions();
  else if(btn.dataset.tab==="yearly")renderYearly();
  else if(btn.dataset.tab==="savings")renderSavings();
});
$("openCustomizeBtn").onclick=()=>$("customizeModal").classList.remove("hidden");$("closeCustomizeBtn").onclick=()=>$("customizeModal").classList.add("hidden");
document.querySelectorAll(".theme-chip").forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;state.customColors=null;saveState();applyTheme()});
document.querySelectorAll(".calendar-style-chip").forEach(b=>b.onclick=()=>{state.calendarStyle=b.dataset.style;saveState();applyTheme()});
$("applyColorsBtn").onclick=()=>{state.customColors={bg:$("customBg").value,accent:$("customAccent").value,card:$("customCard").value};saveState();applyTheme()};
$("emojiEditor").addEventListener("change",e=>{const i=Number(e.target.dataset.emojiIndex);if(Number.isInteger(i)&&state.categories[i]){state.categories[i].emoji=e.target.value||"✨";saveState();populateCategories();renderSelectedDay();renderMonthRecords();renderStats();renderReport()}});
$("backupBtn").onclick=()=>{const payload={...state,photosNotIncluded:true};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`가꾸가계부_백업_${isoDate(new Date())}.json`;a.click();URL.revokeObjectURL(a.href)};
$("restoreInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.records))throw 0;if(!confirm("현재 기록을 백업파일 내용으로 교체할까요?"))return;Object.assign(state,data);saveState();render();alert("백업을 불러왔습니다. 사진은 브라우저 저장형이라 별도로 유지됩니다.")}catch{alert("올바른 백업파일이 아닙니다.")}finally{e.target.value=""}};

function monthTotalsAt(d){
  const mk=monthKey(d);return totals(state.records.filter(r=>r.date.startsWith(mk)));
}
function renderReport(){
  if(!$("reportExpense"))return;
  const now=new Date(viewDate),cur=monthTotalsAt(now),prevDate=new Date(now.getFullYear(),now.getMonth()-1,1),prev=monthTotalsAt(prevDate);
  const budget=Number(state.monthlyBudget[monthKey(now)]||0);
  $("reportExpense").textContent=money(cur.expense);$("reportIncome").textContent=money(cur.income);$("reportBalance").textContent=money(cur.balance);
  $("reportBudgetRate").textContent=budget?Math.round(cur.expense/budget*100)+"%":"미설정";
  const by={};state.records.filter(r=>r.type==="expense"&&r.date.startsWith(monthKey(now))).forEach(r=>by[r.category]=(by[r.category]||0)+Number(r.amount||0));
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];$("reportTopCategory").textContent=top?`${catInfo(top[0]).emoji} ${top[0]}`:"-";
  const diff=cur.expense-prev.expense;
  $("monthCompareText").textContent=prev.expense===0?"지난달 기록이 쌓이면 소비 변화를 알려드릴게요 ♡":diff===0?"지난달과 지출이 같아요 ♡":diff>0?`지난달보다 ${money(diff)} 더 사용했어요. 가장 큰 소비부터 살펴봐요.`:`지난달보다 ${money(Math.abs(diff))} 덜 사용했어요 ♡`;
  const months=[];for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({d,t:monthTotalsAt(d).expense})}
  const max=Math.max(1,...months.map(x=>x.t));
  $("sixMonthChart").innerHTML=months.map(x=>`<div class="month-col"><b>${money(x.t)}</b><div class="month-bar" style="height:${Math.max(3,x.t/max*130)}px"></div><small>${x.d.getMonth()+1}월</small></div>`).join("");
}
function renderGoals(){
  if(!$("goalList"))return;
  $("goalList").innerHTML=state.goals.length?state.goals.map(g=>{const pct=Math.min(100,Math.round(Number(g.current||0)/Number(g.target||1)*100));return `<article class="goal-card"><div class="goal-head"><b>🎯 ${esc(g.name)}</b><strong>${pct}%</strong></div><div class="goal-progress"><div style="width:${pct}%"></div></div><div class="goal-meta"><span>${money(g.current)} / ${money(g.target)}</span><span>${g.date?esc(g.date):"목표일 없음"}</span></div><div class="goal-actions"><button class="soft-btn" onclick="addGoalMoney('${g.id}')">금액 추가</button><button class="delete-btn" onclick="deleteGoal('${g.id}')">삭제</button></div></article>`}).join(""):'<div class="empty">여행, 비상금, 자동차처럼 이루고 싶은 목표를 만들어보세요 ♡</div>';
}
if($("goalForm"))$("goalForm").addEventListener("submit",e=>{e.preventDefault();const name=$("goalName").value.trim(),target=Number($("goalTarget").value),current=Number($("goalCurrent").value||0);if(!name||!target)return alert("목표 이름과 목표 금액을 입력해 주세요.");state.goals.push({id:uid(),name,target,current,date:$("goalDate").value});saveState();e.target.reset();renderGoals()});
function addGoalMoney(id){const g=state.goals.find(x=>x.id===id);if(!g)return;const v=Number(prompt("추가로 모은 금액을 입력해 주세요.","10000"));if(!v||v<0)return;g.current=Number(g.current||0)+v;saveState();renderGoals()}window.addGoalMoney=addGoalMoney;
function deleteGoal(id){if(!confirm("이 저축 목표를 삭제할까요?"))return;state.goals=state.goals.filter(g=>g.id!==id);saveState();renderGoals()}window.deleteGoal=deleteGoal;

function renderSubscriptions(){
  if(!$("subscriptionList"))return;
  const total=state.subscriptions.reduce((s,x)=>s+Number(x.amount||0),0);$("subscriptionMonthlyTotal").textContent=`월 ${money(total)}`;
  $("subscriptionList").innerHTML=state.subscriptions.length?state.subscriptions.map(s=>`<article class="fixed-item"><div><b>💳 ${esc(s.name)}</b><div class="record-meta">매월 ${s.day}일 · ${esc(s.category)}${s.auto!==false?" · 자동반영":" · 수동"}</div></div><strong>${money(s.amount)}</strong><div class="record-actions"><button class="soft-btn" onclick="applySubscription('${s.id}')">이번 달 반영</button><button class="delete-btn" onclick="deleteSubscription('${s.id}')">삭제</button></div></article>`).join(""):'<div class="empty">정기 구독을 등록하면 월 구독료를 한눈에 볼 수 있어요.</div>';
}
if($("subscriptionForm"))$("subscriptionForm").addEventListener("submit",e=>{e.preventDefault();const name=$("subscriptionName").value.trim(),amount=Number($("subscriptionAmount").value),day=Number($("subscriptionDay").value);if(!name||!amount||!day)return alert("서비스명, 금액, 결제일을 입력해 주세요.");state.subscriptions.push({id:uid(),name,amount,day,category:$("subscriptionCategory").value,auto:$("subscriptionAuto")?$("subscriptionAuto").checked:true});saveState();e.target.reset();populateCategories();renderSubscriptions()});
function deleteSubscription(id){if(!confirm("이 구독을 삭제할까요?"))return;state.subscriptions=state.subscriptions.filter(s=>s.id!==id);saveState();renderSubscriptions()}window.deleteSubscription=deleteSubscription;
function applySubscription(id){const s=state.subscriptions.find(x=>x.id===id);if(!s)return;const y=viewDate.getFullYear(),m=viewDate.getMonth(),day=Math.min(s.day,new Date(y,m+1,0).getDate()),date=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const exists=state.records.some(r=>r.subscriptionId===s.id&&r.date.startsWith(monthKey(viewDate)));if(exists&&!confirm("이미 이번 달에 반영되어 있어요. 다시 추가할까요?"))return;state.records.push({id:uid(),subscriptionId:s.id,date,type:"expense",category:s.category,description:s.name,amount:s.amount,payment:"자동",memo:"정기 구독",createdAt:Date.now()});saveState();render();alert("이번 달 지출에 반영했어요.")}window.applySubscription=applySubscription;




function showToast(msg){
  const old=document.querySelector(".toast");if(old)old.remove();
  const el=document.createElement("div");el.className="toast";el.textContent=msg;document.body.appendChild(el);
  setTimeout(()=>el.remove(),2200);
}
function saveCategoryBudgetsFromInputs(){
  const mk=monthKey(viewDate);state.categoryBudgets[mk]=state.categoryBudgets[mk]||{};
  document.querySelectorAll("[data-cat-budget]").forEach(inp=>{
    state.categoryBudgets[mk][inp.dataset.catBudget]=Number(inp.value||0);
  });
  saveState();renderBudget();renderReport();
}
document.addEventListener("change",e=>{if(e.target.matches("[data-cat-budget]"))saveCategoryBudgetsFromInputs()});

document.querySelectorAll("[data-quick-amount]").forEach(b=>b.onclick=()=>{$("quickAmount").value=b.dataset.quickAmount});
if($("quickSaveBtn"))$("quickSaveBtn").onclick=()=>{
  const amount=Number($("quickAmount").value);
  if(!amount||amount<=0)return alert("금액을 입력해 주세요.");
  state.records.push({id:uid(),date:selectedDate,type:"expense",category:$("quickCategory").value,description:$("quickDescription").value.trim()||"빠른 지출",amount,payment:"빠른입력",memo:"",createdAt:Date.now()});
  saveState();const savedCategory=$("quickCategory").value;$("quickAmount").value="";$("quickDescription").value="";render().then(()=>maybeShowBudgetAlert(savedCategory));showToast("빠르게 기록했어요 ♡");
};

function recurringRecordExists(kind,id,mk){
  return state.records.some(r=>r[kind+"Id"]===id && r.date.startsWith(mk));
}
function ensureRecurringForMonth(){
  const mk=monthKey(viewDate),y=viewDate.getFullYear(),m=viewDate.getMonth();
  let changed=false;
  for(const f of state.fixed){
    if(f.ended||f.auto===false||recurringRecordExists("fixed",f.id,mk))continue;
    const day=Math.min(Number(f.day||1),new Date(y,m+1,0).getDate());
    const date=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    state.records.push({id:uid(),fixedId:f.id,date,type:"expense",category:f.category,description:f.name,amount:Number(f.amount||0),payment:"자동",memo:f.memo||"고정비 자동반영",createdAt:Date.now()});
    changed=true;
  }
  for(const s of state.subscriptions){
    if(s.auto===false||recurringRecordExists("subscription",s.id,mk))continue;
    const day=Math.min(Number(s.day||1),new Date(y,m+1,0).getDate());
    const date=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    state.records.push({id:uid(),subscriptionId:s.id,date,type:"expense",category:s.category,description:s.name,amount:Number(s.amount||0),payment:"자동",memo:"정기 구독 자동반영",createdAt:Date.now()});
    changed=true;
  }
  if(changed)saveState();
}


function savingGoalProgress(goal){
  const linked=state.savings.filter(s=>s.goalId===goal.id);
  const deposit=linked.filter(s=>s.type==="deposit").reduce((a,s)=>a+Number(s.amount||0),0);
  const withdraw=linked.filter(s=>s.type==="withdraw").reduce((a,s)=>a+Number(s.amount||0),0);
  const current=Math.max(0,deposit-withdraw),target=Number(goal.target||0);
  return {current,target,remain:Math.max(0,target-current),pct:target?Math.min(100,Math.round(current/target*100)):0};
}
function daysBetween(a,b){
  const d1=new Date(a+"T00:00:00"),d2=new Date(b+"T00:00:00");
  return Math.max(0,Math.ceil((d2-d1)/86400000));
}
function renderSavingGoals(){
  if(!$("savingGoalCards"))return;
  const today=isoDate(new Date());
  $("savingGoalSelect").innerHTML='<option value="">목표 없이 기록</option>'+state.savingGoals.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join("");
  $("savingGoalCards").innerHTML=state.savingGoals.length?state.savingGoals.map(g=>{
    const p=savingGoalProgress(g);
    const totalDays=Math.max(1,daysBetween(g.start,g.end));
    const daysLeft=daysBetween(today,g.end);
    const daily=daysLeft?p.remain/daysLeft:p.remain;
    const monthsLeft=Math.max(1,daysLeft/30.44);
    const monthly=p.remain/monthsLeft;
    const complete=p.current>=p.target&&p.target>0;
    return `<article class="saving-goal-card">
      <div class="saving-goal-head">
        <div>
          <h3>🌱 ${esc(g.name)}</h3>
          <div class="record-meta">${esc(g.start)} → ${esc(g.end)}</div>
        </div>
        <span class="saving-goal-percent">${p.pct}%</span>
      </div>
      <div class="saving-goal-progress"><div style="width:${p.pct}%"></div></div>
      <div class="saving-goal-stats">
        <div><span>현재 모은 금액</span><strong>${money(p.current)}</strong></div>
        <div><span>목표 금액</span><strong>${money(p.target)}</strong></div>
        <div><span>남은 금액</span><strong>${money(p.remain)}</strong></div>
      </div>
      ${complete
        ? `<div class="saving-goal-complete">🎉 목표 달성! 정말 잘했어요 ♡</div>`
        : `<div class="saving-goal-guide">⏰ 목표일까지 <b>${daysLeft}일</b> 남았어요.<br>하루 약 <b>${money(daily)}</b> 또는 한 달 약 <b>${money(monthly)}</b>씩 모으면 목표에 가까워져요.</div>`
      }
      <div class="saving-goal-actions">
        <button class="delete-btn" onclick="deleteSavingGoal('${g.id}')">목표 삭제</button>
      </div>
    </article>`;
  }).join(""):'<div class="empty">아직 저축 목표가 없어요. 여행, 비상금, 자동차처럼 재미있는 목표를 만들어보세요 ♡</div>';
}
function renderSavings(){
  if(!$("savingsList"))return;
  const deposits=state.savings.filter(s=>s.type==="deposit").reduce((a,s)=>a+Number(s.amount||0),0);
  const withdraws=state.savings.filter(s=>s.type==="withdraw").reduce((a,s)=>a+Number(s.amount||0),0);
  const balance=deposits-withdraws;
  $("savingsTotalPill").textContent=money(balance);$("savingsDepositTotal").textContent=money(deposits);$("savingsWithdrawTotal").textContent=money(withdraws);$("savingsBalance").textContent=money(balance);
  renderSavingGoals();
  const sorted=[...state.savings].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  $("savingsList").innerHTML=sorted.length?sorted.map(s=>{
    const goal=state.savingGoals.find(g=>g.id===s.goalId);
    return `<article class="record"><div><b>${s.type==="deposit"?"🐷 저축":"💸 출금"} · ${esc(s.name)}</b><div class="record-meta">${esc(s.date)}${goal?` · 🎯 ${esc(goal.name)}`:""}${s.memo?" · "+esc(s.memo):""}</div></div><div class="record-amount ${s.type==="deposit"?"income":"expense"}">${s.type==="deposit"?"+":"-"}${money(s.amount)}</div><div class="record-actions"><button class="delete-btn" onclick="deleteSaving('${s.id}')">삭제</button></div></article>`;
  }).join(""):'<div class="empty">저축 기록이 아직 없어요. 첫 저축을 시작해 보세요 ♡</div>';
}

if($("savingGoalStart"))$("savingGoalStart").value=isoDate(new Date());
if($("savingGoalEnd")){
  const d=new Date();d.setMonth(d.getMonth()+6);$("savingGoalEnd").value=isoDate(d);
}
if($("savingGoalForm"))$("savingGoalForm").addEventListener("submit",e=>{
  e.preventDefault();
  const name=$("savingGoalName").value.trim(),target=Number($("savingGoalTarget").value);
  const start=$("savingGoalStart").value,end=$("savingGoalEnd").value;
  if(!name||!target||!start||!end)return alert("목표 이름, 금액, 시작일, 목표일을 모두 입력해 주세요.");
  if(new Date(end)<new Date(start))return alert("목표일은 시작일보다 뒤여야 해요.");
  state.savingGoals.push({id:uid(),name,target,start,end,createdAt:Date.now()});
  saveState();e.target.reset();$("savingGoalStart").value=isoDate(new Date());
  const d=new Date();d.setMonth(d.getMonth()+6);$("savingGoalEnd").value=isoDate(d);
  renderSavings();showToast("새 저축 목표를 만들었어요 🌱");
});
function deleteSavingGoal(id){
  const goal=state.savingGoals.find(g=>g.id===id);if(!goal)return;
  if(!confirm(`${goal.name} 목표를 삭제할까요?\n연결된 저축 기록은 삭제되지 않고 그대로 남습니다.`))return;
  state.savingGoals=state.savingGoals.filter(g=>g.id!==id);
  state.savings.forEach(s=>{if(s.goalId===id)s.goalId=""});
  saveState();renderSavings();
}window.deleteSavingGoal=deleteSavingGoal;

if($("savingDate"))$("savingDate").value=isoDate(new Date());
if($("savingsForm"))$("savingsForm").addEventListener("submit",e=>{
  e.preventDefault();
  const amount=Number($("savingAmount").value),goalId=$("savingGoalSelect").value,date=$("savingDate").value||isoDate(new Date());
  const goal=state.savingGoals.find(g=>g.id===goalId);
  const name=$("savingName").value.trim()||goal?.name||"저축";
  if(!amount)return alert("저축 금액을 입력해 주세요.");
  const type=document.querySelector('input[name="savingType"]:checked')?.value||"deposit";
  state.savings.push({id:uid(),type,name,amount,date,goalId,memo:$("savingMemo").value.trim(),createdAt:Date.now()});saveState();
  $("savingAmount").value="";$("savingMemo").value="";renderSavings();
  if(goalId){
    const p=savingGoalProgress(goal);
    showToast(p.pct>=100?`🎉 ${goal.name} 목표 달성!`:`${goal.name} 목표 ${p.pct}% 달성 ♡`);
  }else{
    showToast(type==="deposit"?"저축했어요 ♡":"저축에서 꺼내 쓴 금액을 기록했어요.");
  }
});
function deleteSaving(id){if(!confirm("이 저축 기록을 삭제할까요?"))return;state.savings=state.savings.filter(s=>s.id!==id);saveState();renderSavings()}window.deleteSaving=deleteSaving;

function yearTotals(year){
  const rs=state.records.filter(r=>r.date.startsWith(String(year)+"-"));
  return totals(rs);
}
function renderYearly(){
  if(!$("yearSelect"))return;
  const years=new Set([new Date().getFullYear(),state.selectedYear,...state.records.map(r=>Number(r.date.slice(0,4)))]);
  const sorted=[...years].filter(Boolean).sort((a,b)=>b-a);
  $("yearSelect").innerHTML=sorted.map(y=>`<option value="${y}" ${y===Number(state.selectedYear)?"selected":""}>${y}년</option>`).join("");
  const year=Number(state.selectedYear||new Date().getFullYear()),t=yearTotals(year);
  $("yearIncome").textContent=money(t.income);$("yearExpense").textContent=money(t.expense);$("yearBalance").textContent=money(t.balance);$("yearAvgExpense").textContent=money(t.expense/12);
  const months=[];
  for(let m=0;m<12;m++){const mk=`${year}-${String(m+1).padStart(2,"0")}`;months.push({m:m+1,t:totals(state.records.filter(r=>r.date.startsWith(mk))).expense})}
  const max=Math.max(1,...months.map(x=>x.t));
  $("yearChart").innerHTML=months.map(x=>`<div class="year-col"><b>${money(x.t)}</b><div class="year-bar" style="height:${Math.max(2,x.t/max*155)}px"></div><small>${x.m}월</small></div>`).join("");
  const by={};state.records.filter(r=>r.type==="expense"&&r.date.startsWith(String(year)+"-")).forEach(r=>by[r.category]=(by[r.category]||0)+Number(r.amount||0));
  const cmax=Math.max(1,...Object.values(by));
  $("yearCategoryBars").innerHTML=Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span class="bar-name">${esc(catInfo(k).emoji)} ${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/cmax*100}%"></div></div><span class="bar-value">${money(v)}</span></div>`).join(""):'<div class="empty">올해 지출 기록이 아직 없어요.</div>';
}
if($("yearSelect"))$("yearSelect").onchange=e=>{state.selectedYear=Number(e.target.value);saveState();renderYearly()};

function roundedRect(ctx,x,y,w,h,r,fill){
  ctx.beginPath();
  if(ctx.roundRect){ctx.roundRect(x,y,w,h,r);}
  else{ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);}
  ctx.fillStyle=fill;ctx.fill();
}
function canvasText(ctx,text,x,y,size,color,weight="600",align="left"){
  ctx.font=`${weight} ${size}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);
}
function makeReportPNG(){
  const mk=monthKey(viewDate),cur=monthTotalsAt(viewDate),prevDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1),prev=monthTotalsAt(prevDate);
  const budget=Number(state.monthlyBudget[mk]||0);
  const by={};state.records.filter(r=>r.type==="expense"&&r.date.startsWith(mk)).forEach(r=>by[r.category]=(by[r.category]||0)+Number(r.amount||0));
  const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
  const theme=getComputedStyle(document.body),bg=theme.getPropertyValue("--bg").trim()||"#f7f2ea",card=theme.getPropertyValue("--card").trim()||"#fffdf9",ink=theme.getPropertyValue("--ink").trim()||"#4c403a",muted=theme.getPropertyValue("--muted").trim()||"#8d7f77",accent=theme.getPropertyValue("--accent").trim()||"#b7836f",soft=theme.getPropertyValue("--soft").trim()||"#f3e8df";
  const c=document.createElement("canvas");c.width=1080;c.height=1350;const ctx=c.getContext("2d");ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);
  roundedRect(ctx,65,65,950,1220,42,card);
  canvasText(ctx,"가꾸 가계부 ♡",120,150,34,accent,"800");
  canvasText(ctx,`${viewDate.getFullYear()}년 ${viewDate.getMonth()+1}월 소비 리포트`,120,215,48,ink,"800");
  canvasText(ctx,"이번 달 지출",120,300,24,muted,"700");canvasText(ctx,money(cur.expense),120,365,58,accent,"800");
  let compare="지난달 기록이 아직 없어요.";
  if(prev.expense){const d=cur.expense-prev.expense;compare=d>0?`지난달보다 ${money(d)} 더 사용했어요.`:d<0?`지난달보다 ${money(Math.abs(d))} 덜 사용했어요 ♡`:"지난달과 지출이 같아요."}
  canvasText(ctx,compare,120,425,24,ink,"700");
  const boxes=[
    ["수입",money(cur.income)],["남긴 돈",money(cur.balance)],["예산 사용률",budget?Math.round(cur.expense/budget*100)+"%":"미설정"],["가장 큰 소비",top?`${catInfo(top[0]).emoji} ${top[0]}`:"-"]
  ];
  boxes.forEach((b,i)=>{const x=120+(i%2)*425,y=485+Math.floor(i/2)*150;roundedRect(ctx,x,y,390,120,24,soft);canvasText(ctx,b[0],x+25,y+38,20,muted,"700");canvasText(ctx,b[1],x+25,y+82,30,ink,"800")});
  canvasText(ctx,"최근 6개월 지출",120,820,28,ink,"800");
  const months=[];for(let i=5;i>=0;i--){const d=new Date(viewDate.getFullYear(),viewDate.getMonth()-i,1);months.push({m:d.getMonth()+1,t:monthTotalsAt(d).expense})}
  const max=Math.max(1,...months.map(x=>x.t)),baseY=1120;
  months.forEach((x,i)=>{const bx=145+i*135,bh=Math.max(5,x.t/max*230);roundedRect(ctx,bx,baseY-bh,72,bh,18,accent);canvasText(ctx,`${x.m}월`,bx+36,baseY+35,18,muted,"700","center")});
  canvasText(ctx,"꾸미는 재미가 있는 나만의 생활·저축 플래너",540,1235,21,muted,"600","center");
  c.toBlob(blob=>{const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`가꾸가계부_${mk}_소비리포트.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},"image/png");
}
if($("saveReportImageBtn"))$("saveReportImageBtn").onclick=makeReportPNG;

applyTheme();render();
