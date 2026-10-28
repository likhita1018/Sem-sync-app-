/* SemesterSync v5: term publishing (timetable -> dated sessions), My day (student layer), import wizard */
(()=>{
const {toast,note,dlg,when}=window.SS,ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
const T0=()=>plan.term||(plan.term={start:'',end:'',hol:'',skip:[]});

/* ---- Timetable -> dated sessions ---- */
function hols(s){const o=new Set();String(s||'').split(',').map(x=>x.trim()).filter(Boolean).forEach(x=>{const[a,b]=x.split('..');for(let d=new Date(a+'T00:00'),e=new Date((b||a)+'T00:00'),i=0;d<=e&&i<400;d.setDate(d.getDate()+1),i++)o.add(iso(d))});return o}
const gs=x=>[x.title,x.faculty,x.room,x.start,x.end].join('|');
function expand(s,e,H){const want=new Map(),skip=new Set(T0().skip||[]);
  for(let d=new Date(s+'T00:00'),n=0;iso(d)<=e&&n<400;d.setDate(d.getDate()+1),n++){const ds=iso(d),wd=DAYS[(d.getDay()+6)%7];if(!wd||H.has(ds))continue;
    plan.classes.forEach(c=>c.slots.forEach((sl,j)=>{const y=c.tt[wd+'|'+j],k=`tt:${c.id}:${wd}:${j}:${ds}`;if(y&&!skip.has(k))want.set(k,{title:y.sub,faculty:y.fac||'',type:'Lecture',date:ds,start:sl.s,end:sl.e,allDay:false,room:y.room||'',notes:c.name,cls:c.name})}))}
  const have=new Map(events.filter(x=>x.key&&x.key.startsWith('tt:')).map(x=>[x.key,x]));let add=0,upd=0,del=0;
  want.forEach((w,k)=>{const o=have.get(k);if(!o){events.push({...w,id:crypto.randomUUID(),key:k,g:gs(w)});add++}else if(gs(o)===o.g&&gs(w)!==o.g){Object.assign(o,w,{g:gs(w)});upd++}});
  have.forEach((o,k)=>{if(!want.has(k)&&gs(o)===o.g&&o.date>=s&&o.date<=e){events.splice(events.indexOf(o),1);del++}});return{add,upd,del}}
function publish(){const t=T0();dlg(`<h2>Publish timetable to calendar</h2><p class="sub">Turns each weekly slot into dated sessions for the term, skipping holidays. Sessions you changed (cover, room) are kept when you publish again, and cancelled sessions stay cancelled.</p><div class="two"><div class="field"><label>Term start</label><input type="date" id="ts" value="${t.start}"></div><div class="field"><label>Term end</label><input type="date" id="te" value="${t.end}"></div></div><div class="field"><label>Holidays: dates or ranges, e.g. 2026-11-08, 2026-12-24..2027-01-02</label><input id="th" value="${esc(t.hol)}"></div><div class="foot"><button class="btn" id="tx">Cancel</button><button class="btn primary" id="tg">Publish</button></div>`);
  $('tx').onclick=()=>$('xm').remove();
  $('tg').onclick=()=>{const s=$('ts').value,e=$('te').value;if(!s||!e||e<s)return toast('Choose valid term dates');Object.assign(t,{start:s,end:e,hol:$('th').value});savePlan();const r=expand(s,e,hols(t.hol));persist();render();$('xm').remove();
    toast(`Published: ${r.add} added, ${r.upd} updated, ${r.del} removed`);if(r.add||r.del)note(`Timetable published for ${s} to ${e}: ${r.add} sessions added, ${r.del} removed`)}}
const od=$('del').onclick;$('del').onclick=()=>{const w=delArm,e=events.find(x=>x.id===editId);od();if(w&&e&&e.key&&e.key.startsWith('tt:')){const t=T0();(t.skip||(t.skip=[])).push(e.key);savePlan()}};
const orp=renderPlan;renderPlan=function(){orp();const r=$('planView').querySelector('.bar .row');if(r)r.insertAdjacentHTML('beforeend','<button class="btn" data-xpub="1">Publish to calendar</button>')};
document.addEventListener('click',e=>{if(e.target.closest('[data-xpub]'))publish()});

/* ---- My day: today timeline, attendance, deadlines, goals (private, on-device only) ---- */
const ST=ls('ss.st',{sub:[],dl:[],goals:[]}),sst=()=>localStorage.setItem('ss.st',JSON.stringify(ST));
const bunk=(a,t,p)=>{p=p||75;return t&&a*100/t>=p?{ok:true,n:Math.max(0,Math.floor(a*100/p-t))}:{ok:false,n:Math.ceil((p*t-100*a)/(100-p))}};
function me(tab='today'){const t=iso(new Date()),yd=iso(new Date(Date.now()-864e5)),days=d=>Math.round((new Date(d+'T00:00')-new Date(t+'T00:00'))/864e5);let h='';
  if(tab==='today'){const ev=events.filter(e=>e.date===t).sort((a,b)=>(a.start||'').localeCompare(b.start||'')),dl=ST.dl.filter(d=>!d.done&&days(d.due)<=2).sort((a,b)=>a.due.localeCompare(b.due)),
      load=ST.dl.filter(d=>!d.done&&days(d.due)>=0).reduce((s,d)=>s+(+d.h||0)/Math.max(1,days(d.due)),0);
    h=(ev.length?ev.map(e=>`<div class="ch"><b>${esc(e.title)}</b><small>${e.allDay?'All day':fmtT(e.start)+' to '+fmtT(e.end)}${e.room?' · '+esc(e.room):''}${e.faculty?' · '+esc(e.faculty):''}</small></div>`).join(''):'<p class="sub">No classes today.</p>')
     +dl.map(d=>`<div class="ch"><b>${days(d.due)<0?'Overdue':days(d.due)?'Due in '+days(d.due)+' days':'Due today'}: ${esc(d.title)}</b><small>${esc(d.sub||'')}</small></div>`).join('')
     +(load?`<p class="sub">About ${load.toFixed(1)}h of deadline work today keeps you on track.</p>`:'')
     +ST.goals.filter(g=>g.last!==t).map(g=>`<div class="ch"><b>Goal: ${esc(g.t)}</b><small>not done today</small></div>`).join('')}
  if(tab==='att')h=ST.sub.map((s,i)=>{const r=bunk(s.a,s.t,s.p);return`<div class="ch"><b>${esc(s.n)} · ${s.t?Math.round(s.a*1000/s.t)/10:100}% (${s.a}/${s.t})</b><small>${!s.t?'No classes recorded yet':r.ok?'You can miss '+r.n+' more and stay above '+(s.p||75)+'%':'Attend the next '+r.n+' classes to reach '+(s.p||75)+'%'}</small><div class="row"><button class="btn" data-a="p${i}">Present</button><button class="btn" data-a="a${i}">Absent</button><button class="btn" data-a="x${i}">Remove</button></div></div>`}).join('')+'<div class="row"><input id="mn" placeholder="Subject name"><button class="btn primary" data-a="addsub">Add</button><button class="btn" data-a="imp">Import from timetable</button></div>';
  if(tab==='dl')h=ST.dl.map((d,i)=>[d,i]).sort((a,b)=>a[0].done-b[0].done||a[0].due.localeCompare(b[0].due)).map(([d,i])=>`<div class="ch" style="${d.done?'opacity:.5':''}"><b>${esc(d.title)}</b><small>${esc(d.sub||'')} · due ${esc(when(d.due))}${d.h?' · '+d.h+'h':''}</small><div class="row"><button class="btn" data-a="d${i}">${d.done?'Undo':'Done'}</button><button class="btn" data-a="r${i}">Remove</button></div></div>`).join('')+'<div class="two"><input id="dn" placeholder="Title"><input id="ds" placeholder="Subject"></div><div class="two"><input id="dd" type="date"><input id="dh" type="number" placeholder="Effort (hours)"></div><button class="btn primary" data-a="adddl">Add deadline</button>';
  if(tab==='goal')h=ST.goals.map((g,i)=>`<div class="ch"><b>${esc(g.t)}</b><small>Streak: ${g.s||0} day${g.s==1?'':'s'}${g.last===t?' · done today':''}</small><div class="row"><button class="btn" data-a="g${i}">Done today</button><button class="btn" data-a="y${i}">Remove</button></div></div>`).join('')+'<p class="sub">Goals stay on this device and are never sent to your institution.</p><div class="row"><input id="gn" placeholder="New goal"><button class="btn primary" data-a="addg">Add</button></div>';
  dlg('<h2>My day</h2><div class="row">'+[['today','Today'],['att','Attendance'],['dl','Deadlines'],['goal','Goals']].map(([k,l])=>`<button class="btn ${k===tab?'primary':''}" data-t="${k}">${l}</button>`).join('')+'</div>'+h+'<div class="foot"><span></span><button class="btn" data-a="close">Close</button></div>');
  const m=$('xm');m.onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.t)return me(b.dataset.t);const a=b.dataset.a;if(a==='close')return m.remove();const act=a.replace(/\d+/g,''),i=+a.replace(/\D/g,''),S=ST.sub[i],D=ST.dl[i],G=ST.goals[i];
    if(act==='p'){S.a++;S.t++}else if(act==='a')S.t++;else if(act==='x')ST.sub.splice(i,1);
    else if(act==='d')D.done=!D.done;else if(act==='r')ST.dl.splice(i,1);
    else if(act==='g'){if(G.last!==t){G.s=G.last===yd?(G.s||0)+1:1;G.last=t}}else if(act==='y')ST.goals.splice(i,1);
    else if(act==='addsub'){const n=$('mn').value.trim();if(n)ST.sub.push({n,a:0,t:0,p:75})}
    else if(act==='imp')cur().subjects.forEach(s=>{if(s.name&&!ST.sub.some(x=>x.n===s.name))ST.sub.push({n:s.name,a:0,t:0,p:75})});
    else if(act==='adddl'){const n=$('dn').value.trim(),d=$('dd').value;if(n&&d)ST.dl.push({title:n,sub:$('ds').value.trim(),due:d,h:+$('dh').value||0,done:false})}
    else if(act==='addg'){const n=$('gn').value.trim();if(n)ST.goals.push({t:n,s:0,last:''})}
    sst();me(tab)}}

/* ---- Import wizard: preview, validate, then import ---- */
function review(list,name){const issues=[],ok=[],seen=new Set(events.map(e=>e.date+e.start+e.title));
  list.forEach((e,i)=>{const k=e.date+e.start+e.title;if(seen.has(k)){issues.push('Row '+(i+1)+': duplicate, skipped ('+e.title+')');return}
    if(e.start&&e.end&&e.end<e.start){issues.push('Row '+(i+1)+': ends before it starts, skipped ('+e.title+')');return}
    const c=ok.concat(events).find(x=>x.date===e.date&&!x.allDay&&e.start&&x.start&&e.start<(x.end||x.start)&&x.start<(e.end||e.start)&&((e.room&&x.room===e.room)||(e.faculty&&x.faculty===e.faculty)));
    if(c)issues.push('Row '+(i+1)+': '+e.title+' overlaps "'+c.title+'" in the same room or with the same faculty (imported, please review)');seen.add(k);ok.push(e)});
  dlg(`<h2>Import preview: ${esc(name)}</h2><p><b>${ok.length}</b> ready to import, <b>${list.length-ok.length}</b> skipped.</p>${issues.slice(0,40).map(x=>'<div class="ch">'+esc(x)+'</div>').join('')}<div class="foot"><button class="btn" id="ix">Cancel</button><button class="btn primary" id="ig"${ok.length?'':' disabled'}>Import ${ok.length}</button></div>`);
  $('ix').onclick=()=>$('xm').remove();$('ig').onclick=()=>{events.push(...ok);persist();render();$('xm').remove();toast('Imported '+ok.length+' events');note(ok.length+' events imported from '+name)}}
const fi=document.querySelector('input[type=file][hidden]');
fi.onchange=async()=>{const f=fi.files[0];if(!f)return;let t;try{t=/\.xlsx$/i.test(f.name)?await window.xlsxToCSV(f):await f.text()}catch(e){return toast('Could not read that file')}fi.value='';review(/\.ics$/i.test(f.name)||t.includes('BEGIN:VCALENDAR')?window.SS.fromICS(t):window.SS.fromCSV(t),f.name)};

const sy=document.createElement('style');sy.textContent='body.ro [data-xpub]{display:none!important}.xm input{padding:8px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;min-width:0;flex:1}';document.head.appendChild(sy);
document.querySelector('.tools').insertAdjacentHTML('afterbegin','<button class="btn primary" id="xd">My day</button>');$('xd').onclick=()=>me('today');
})();
