const STORAGE_KEY="gaggu_budget_v2";
const DB_NAME="gaggu_photo_db_v1";
const DB_STORE="photos";
const defaultCategories=[
  {name:"식비",emoji:"🍚"},{name:"카페",emoji:"☕"},{name:"교통",emoji:"🚌"},{name:"쇼핑",emoji:"🛍️"},
  {name:"생활",emoji:"🧺"},{name:"고정비",emoji:"🏠"},{name:"의료",emoji:"💊"},{name:"여가",emoji:"🎬"},
  {name:"급여",emoji:"💰"},{name:"용돈",emoji:"💌"},{name:"기타",emoji:"✨"}
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
      categories:Array.isArray(s.categories)&&s.categories.length?s.categories:structuredClone(defaultCategories)
    };
  }catch{
    return {records:[],monthlyBudget:{},fixed:[],theme:"cream",calendarStyle:"soft",customColors:null,categories:structuredClone(defaultCategories)};
  }
}
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
async function photoCountsForDates(dates){const out={};for(const d of dates){out[d]=(await getPhotosByDate(d)).length}return out}
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
function populateCategories(){
  const html=state.categories.map(c=>`<option value="${esc(c.name)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join("");
  $("category").innerHTML=html;$("fixedCategory").innerHTML=html;
  $("emojiEditor").innerHTML=state.categories.map((c,i)=>`<div class="emoji-row"><strong>${esc(c.name)}</strong><input data-emoji-index="${i}" value="${esc(c.emoji)}" maxlength="4"></div>`).join("");
}
async function render(){
  applyTheme();populateCategories();
  await renderCalendar();renderSelectedDay();renderMonthSummary();renderMonthRecords();renderBudget();renderFixed();renderStats();await renderPhotos();
}
async function renderCalendar(){
  const y=viewDate.getFullYear(),m=viewDate.getMonth();$("monthTitle").textContent=`${y}년 ${m+1}월`;
  const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),today=isoDate(new Date()),cal=$("calendar");cal.innerHTML="";
  const dates=[];for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);dates.push(isoDate(d))}
  const photoCounts=await photoCountsForDates(dates);
  for(let i=0;i<42;i++){
    const d=new Date(start);d.setDate(start.getDate()+i);const date=isoDate(d),rs=recordsForDate(date),t=totals(rs),pc=photoCounts[date]||0;
    const el=document.createElement("button");el.type="button";el.className="day";if(d.getMonth()!==m)el.classList.add("other");if(date===selectedDate)el.classList.add("selected");if(date===today)el.classList.add("today");
    el.innerHTML=`<span class="day-num">${d.getDate()}</span><div class="day-money">${t.expense?`<div class="day-expense">-${money(t.expense)}</div>`:""}${t.income?`<div class="day-income">+${money(t.income)}</div>`:""}${pc?`<span class="photo-count">📷 ${pc}</span>`:""}</div>`;
    el.onclick=()=>{selectedDate=date;if(d.getMonth()!==m)viewDate=new Date(d.getFullYear(),d.getMonth(),1);render()};cal.appendChild(el);
  }
}
function renderSelectedDay(){
  const d=new Date(selectedDate+"T00:00:00");$("selectedDateTitle").textContent=`${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  const rs=recordsForDate(selectedDate).sort((a,b)=>b.createdAt-a.createdAt),t=totals(rs);$("selectedDayTotal").textContent=`지출 ${money(t.expense)} · 수입 ${money(t.income)}`;
  $("records").innerHTML=rs.length?rs.map(r=>`<article class="record"><div><b>${esc(catInfo(r.category).emoji)} ${esc(r.category)} · ${esc(r.description||"내용 없음")}</b><div class="record-meta">${esc(r.payment||"-")}${r.memo?" · "+esc(r.memo):""}</div></div><div class="record-amount ${r.type}">${r.type==="income"?"+":"-"}${money(r.amount)}</div><div class="record-actions"><button class="delete-btn" onclick="deleteRecord('${r.id}')">삭제</button></div></article>`).join(""):'<div class="empty">아직 기록이 없어요.</div>';
}
function renderMonthSummary(){
  const rs=state.records.filter(r=>r.date.startsWith(monthKey(viewDate))),t=totals(rs),budget=Number(state.monthlyBudget[monthKey(viewDate)]||0);
  $("incomeTotal").textContent=money(t.income);$("expenseTotal").textContent=money(t.expense);$("balanceTotal").textContent=money(t.balance);$("budgetRemain").textContent=budget?money(Math.max(0,budget-t.expense)):"미설정";
}
function renderMonthRecords(){
  const mk=monthKey(viewDate),q=$("searchInput").value.trim().toLowerCase();
  const rs=state.records.filter(r=>r.date.startsWith(mk)).filter(r=>!q||[r.category,r.description,r.payment,r.memo].some(v=>String(v||"").toLowerCase().includes(q))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt-a.createdAt);
  $("monthRecords").innerHTML=rs.length?rs.map(r=>`<article class="record"><div><b>${esc(r.date)} · ${esc(catInfo(r.category).emoji)} ${esc(r.category)} · ${esc(r.description||"내용 없음")}</b><div class="record-meta">${esc(r.payment||"-")}${r.memo?" · "+esc(r.memo):""}</div></div><div class="record-amount ${r.type}">${r.type==="income"?"+":"-"}${money(r.amount)}</div></article>`).join(""):'<div class="empty">이번 달 기록이 없습니다.</div>';
}
function renderBudget(){
  const mk=monthKey(viewDate),budget=Number(state.monthlyBudget[mk]||0),rs=state.records.filter(r=>r.date.startsWith(mk)&&r.type==="expense"),spent=totals(rs).expense,remain=Math.max(0,budget-spent),pct=budget?Math.min(100,(spent/budget)*100):0;
  $("monthlyBudget").value=budget||"";$("budgetPercent").textContent=`${Math.round(pct)}%`;$("budgetProgress").style.width=pct+"%";$("budgetMetric").textContent=money(budget);$("spentMetric").textContent=money(spent);$("remainMetric").textContent=money(remain);
  const by={};for(const r of rs)by[r.category]=(by[r.category]||0)+Number(r.amount||0);const max=Math.max(1,...Object.values(by));
  $("categoryBudgetList").innerHTML=Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span class="bar-name">${esc(catInfo(k).emoji)} ${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-value">${money(v)}</span></div>`).join(""):'<div class="empty">아직 지출 기록이 없어요.</div>';
}
function renderFixed(){
  $("fixedList").innerHTML=state.fixed.length?state.fixed.map(f=>`<article class="fixed-item"><div><b>${esc(catInfo(f.category).emoji)} ${esc(f.name)}</b><div class="record-meta">매월 ${f.day}일 · ${esc(f.category)}${f.memo?" · "+esc(f.memo):""}</div></div><strong>${money(f.amount)}</strong><div class="record-actions"><button class="soft-btn" onclick="addFixedToMonth('${f.id}')">이번 달 반영</button><button class="delete-btn" onclick="deleteFixed('${f.id}')">삭제</button></div></article>`).join(""):'<div class="empty">등록된 고정비가 없어요.</div>';
}
function renderStats(){
  const mk=monthKey(viewDate),rs=state.records.filter(r=>r.date.startsWith(mk)),t=totals(rs),saveRate=t.income?Math.max(0,Math.round((t.balance/t.income)*100)):0;$("statIncome").textContent=money(t.income);$("statExpense").textContent=money(t.expense);$("savingRate").textContent=saveRate+"%";
  const by={};for(const r of rs.filter(r=>r.type==="expense"))by[r.category]=(by[r.category]||0)+Number(r.amount||0);const max=Math.max(1,...Object.values(by));
  $("statBars").innerHTML=Object.keys(by).length?Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="bar-row"><span class="bar-name">${esc(catInfo(k).emoji)} ${esc(k)}</span><div class="bar-track"><div class="bar-fill" style="width:${v/max*100}%"></div></div><span class="bar-value">${money(v)}</span></div>`).join(""):'<div class="empty">통계를 만들 지출 기록이 없어요.</div>';
}
async function renderPhotos(){
  const photos=await getPhotosByDate(selectedDate);$("photoGrid").innerHTML=photos.length?photos.map(p=>`<button class="photo-thumb" onclick="openPhoto('${p.id}')"><img src="${URL.createObjectURL(p.blob)}"></button>`).join(""):'<div class="empty" style="grid-column:1/-1">사진을 추가하면 여기에 모여요.</div>';
}
$("entryForm").addEventListener("submit",e=>{e.preventDefault();const amount=Number($("amount").value);if(!amount||amount<=0)return alert("금액을 입력해 주세요.");const type=document.querySelector('input[name="type"]:checked').value;state.records.push({id:uid(),date:selectedDate,type,category:$("category").value,description:$("description").value.trim(),amount,payment:$("payment").value,memo:$("memo").value.trim(),createdAt:Date.now()});saveState();$("description").value="";$("amount").value="";$("memo").value="";render()});
function deleteRecord(id){const i=state.records.findIndex(r=>r.id===id);if(i<0||!confirm("이 기록을 삭제할까요?"))return;state.records.splice(i,1);saveState();render()}window.deleteRecord=deleteRecord;
$("clearDayBtn").onclick=()=>{const rs=recordsForDate(selectedDate);if(!rs.length)return;if(!confirm("이날 기록을 모두 삭제할까요?"))return;state.records=state.records.filter(r=>r.date!==selectedDate);saveState();render()};
$("prevMonth").onclick=()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()-1,1);render()};$("nextMonth").onclick=()=>{viewDate=new Date(viewDate.getFullYear(),viewDate.getMonth()+1,1);render()};$("todayBtn").onclick=()=>{const n=new Date();viewDate=new Date(n.getFullYear(),n.getMonth(),1);selectedDate=isoDate(n);render()};
$("searchInput").oninput=renderMonthRecords;
$("saveBudgetBtn").onclick=()=>{state.monthlyBudget[monthKey(viewDate)]=Number($("monthlyBudget").value||0);saveState();render()};
$("fixedForm").addEventListener("submit",e=>{e.preventDefault();const amount=Number($("fixedAmount").value),day=Number($("fixedDay").value);if(!$("fixedName").value.trim()||!amount||!day)return alert("이름, 금액, 결제일을 입력해 주세요.");state.fixed.push({id:uid(),name:$("fixedName").value.trim(),amount,day,category:$("fixedCategory").value,memo:$("fixedMemo").value.trim()});saveState();e.target.reset();populateCategories();renderFixed()});
function deleteFixed(id){if(!confirm("이 고정비를 삭제할까요?"))return;state.fixed=state.fixed.filter(f=>f.id!==id);saveState();renderFixed()}window.deleteFixed=deleteFixed;
function addFixedToMonth(id){const f=state.fixed.find(x=>x.id===id);if(!f)return;const y=viewDate.getFullYear(),m=viewDate.getMonth(),last=new Date(y,m+1,0).getDate(),day=Math.min(f.day,last),date=`${y}-${String(m+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;const exists=state.records.some(r=>r.fixedId===f.id&&r.date.startsWith(monthKey(viewDate)));if(exists&&!confirm("이미 이번 달에 반영된 기록이 있어요. 다시 추가할까요?"))return;state.records.push({id:uid(),fixedId:f.id,date,type:"expense",category:f.category,description:f.name,amount:f.amount,payment:"자동",memo:f.memo,createdAt:Date.now()});saveState();render();alert("이번 달 고정비에 반영했어요.")}window.addFixedToMonth=addFixedToMonth;
$("photoInput").onchange=async e=>{const files=[...(e.target.files||[])];for(const file of files){try{const blob=await compressImage(file);await addPhotoRecord({id:uid(),date:selectedDate,blob,createdAt:Date.now()})}catch(err){console.error(err)}}e.target.value="";await render()};
async function openPhoto(id){const db=await openDB();const rec=await new Promise((res,rej)=>{const req=db.transaction(DB_STORE,"readonly").objectStore(DB_STORE).get(id);req.onsuccess=()=>res(req.result);req.onerror=()=>rej(req.error)});if(!rec)return;activePhotoId=id;$("viewerImage").src=URL.createObjectURL(rec.blob);$("photoViewer").classList.remove("hidden")}window.openPhoto=openPhoto;
$("closeViewerBtn").onclick=()=>$("photoViewer").classList.add("hidden");$("deletePhotoBtn").onclick=async()=>{if(!activePhotoId||!confirm("이 사진을 삭제할까요?"))return;await deletePhotoRecord(activePhotoId);activePhotoId=null;$("photoViewer").classList.add("hidden");await render()};
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".tab-panel").forEach(p=>p.classList.toggle("active",p.id==="tab-"+btn.dataset.tab));render()});
$("openCustomizeBtn").onclick=()=>$("customizeModal").classList.remove("hidden");$("closeCustomizeBtn").onclick=()=>$("customizeModal").classList.add("hidden");
document.querySelectorAll(".theme-chip").forEach(b=>b.onclick=()=>{state.theme=b.dataset.theme;state.customColors=null;saveState();applyTheme()});
document.querySelectorAll(".calendar-style-chip").forEach(b=>b.onclick=()=>{state.calendarStyle=b.dataset.style;saveState();applyTheme()});
$("applyColorsBtn").onclick=()=>{state.customColors={bg:$("customBg").value,accent:$("customAccent").value,card:$("customCard").value};saveState();applyTheme()};
$("emojiEditor").addEventListener("change",e=>{const i=Number(e.target.dataset.emojiIndex);if(Number.isInteger(i)&&state.categories[i]){state.categories[i].emoji=e.target.value||"✨";saveState();populateCategories();render()}});
$("backupBtn").onclick=()=>{const payload={...state,photosNotIncluded:true};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`가꾸가계부_백업_${isoDate(new Date())}.json`;a.click();URL.revokeObjectURL(a.href)};
$("restoreInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const data=JSON.parse(await f.text());if(!Array.isArray(data.records))throw 0;if(!confirm("현재 기록을 백업파일 내용으로 교체할까요?"))return;Object.assign(state,data);saveState();render();alert("백업을 불러왔습니다. 사진은 브라우저 저장형이라 별도로 유지됩니다.")}catch{alert("올바른 백업파일이 아닙니다.")}finally{e.target.value=""}};
applyTheme();render();
