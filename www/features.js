/* SemesterSync v3 layer: sync (ICS/CSV), change alerts, auto-timetable, leave & cover, today hero */
(()=>{
const CK='semestersync.changes.v1',LK='semestersync.seen.v1',pad=n=>String(n).padStart(2,'0'),ov=(a,b,c,d)=>a<d&&c<b;
let changes=[];try{changes=JSON.parse(localStorage.getItem(CK)||'[]')}catch(e){}
let seen=+(localStorage.getItem(LK)||0);
const toast=m=>{const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),3000)};
const when=(d,s)=>{const t=new Date(d+'T00:00'),n=new Date();n.setHours(0,0,0,0);const df=Math.round((t-n)/864e5);return(df===0?'today':df===1?'tomorrow':t.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}))+(s?' '+s:'')};
const unread=()=>changes.filter(c=>c.t>seen).length;
function badge(){const b=$('xa');if(b)b.textContent='Changes'+(unread()?' ('+unread()+')':'')}
function note(m){changes.unshift({t:Date.now(),m});try{localStorage.setItem(CK,JSON.stringify(changes.slice(0,100)))}catch(e){}badge();
  try{const L=window.Capacitor?.Plugins?.LocalNotifications;if(L)L.requestPermissions().then(()=>L.schedule({notifications:[{id:Date.now()%2147483647,title:'Schedule change',body:m}]}))}catch(e){}}
function dlg(h){let m=$('xm');if(!m){m=document.createElement('div');m.id='xm';m.className='xm';m.addEventListener('click',e=>{if(e.target===m)m.remove()});document.body.appendChild(m)}m.innerHTML='<div class="dlg">'+h+'</div>'}
async function out(name,mime,text){try{const P=window.Capacitor?.Plugins;if(P?.Filesystem&&P?.Share){const r=await P.Filesystem.writeFile({path:name,data:btoa(unescape(encodeURIComponent(text))),directory:'CACHE'});await P.Share.share({title:name,url:r.uri});return}}catch(e){}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime}));a.download=name;a.click()}

/* ---- ICS / CSV ---- */
const ie=s=>String(s||'').replace(/[\\;,]/g,'\\$&').replace(/\n/g,'\\n'),st=(d,t)=>d.replace(/-/g,'')+(t?'T'+t.replace(':','')+'00':'');
function toICS(list){const L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SemesterSync//EN','X-WR-CALNAME:SemesterSync'],ts=new Date().toISOString().replace(/[-:]|\.\d+/g,'');
  list.forEach(e=>{L.push('BEGIN:VEVENT','UID:'+e.id+'@semestersync','DTSTAMP:'+ts);
    if(e.allDay||!e.start)L.push('DTSTART;VALUE=DATE:'+st(e.date));else L.push('DTSTART:'+st(e.date,e.start),'DTEND:'+st(e.date,e.end||e.start));
    L.push('SUMMARY:'+ie(e.title),'LOCATION:'+ie(e.room),'DESCRIPTION:'+ie((e.faculty?e.faculty+'. ':'')+(e.notes||'')),'CATEGORIES:'+e.type);
    if(e.start&&!e.allDay)L.push('BEGIN:VALARM','TRIGGER:-PT15M','ACTION:DISPLAY','DESCRIPTION:'+ie(e.title),'END:VALARM');L.push('END:VEVENT')});
  L.push('END:VCALENDAR');return L.join('\r\n')}
const dt=x=>{if(x.endsWith('Z')){const d=new Date(Date.UTC(+x.slice(0,4),x.slice(4,6)-1,+x.slice(6,8),+x.slice(9,11),+x.slice(11,13)));return[iso(d),pad(d.getHours())+':'+pad(d.getMinutes())]}return[x.slice(0,4)+'-'+x.slice(4,6)+'-'+x.slice(6,8),x.length>8?x.slice(9,11)+':'+x.slice(11,13):'']};
function fromICS(t){t=t.replace(/\r?\n[ \t]/g,'');const o=[];t.split('BEGIN:VEVENT').slice(1).forEach(b=>{const g=k=>{const m=b.match(new RegExp('\\n'+k+'[^:\\n]*:(.*)'));return m?m[1].trim().replace(/\\n/g,'\n').replace(/\\([,;\\])/g,'$1'):''};
  const a=g('DTSTART'),z=g('DTEND');if(!a)return;const[d,s]=dt(a),e=z?dt(z)[1]:'';o.push({id:uid(),title:g('SUMMARY')||'Untitled',faculty:'',type:'Other',date:d,start:s,end:e,allDay:a.length<=8,room:g('LOCATION'),notes:g('DESCRIPTION')})});return o}
function parseCSV(t){const r=[];let w=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}else if(c=='"')q=true;else if(c==','){w.push(f);f=''}else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;w.push(f);r.push(w);w=[];f=''}else f+=c}if(f||w.length){w.push(f);r.push(w)}return r.filter(x=>x.some(y=>y.trim()))}
function fromCSV(t){const[h,...rs]=parseCSV(t.replace(/^\uFEFF/,''));if(!h)return[];const k=h.map(x=>x.trim().toLowerCase());
  return rs.map(r=>{const v=n=>(r[k.indexOf(n)]||'').trim(),ty=v('type').toLowerCase();return{id:uid(),title:v('title')||v('subject'),faculty:v('faculty'),type:TYPES.find(x=>x.toLowerCase()===ty||label(x).toLowerCase()===ty)||'Other',date:v('date'),start:v('start'),end:v('end'),allDay:!v('start'),room:v('room'),notes:v('notes')}}).filter(e=>e.title&&/^\d{4}-\d{2}-\d{2}$/.test(e.date))}

/* ---- Change alerts: wrap save/delete ---- */
function diff(o,n){const p=[];if(o.room!==n.room&&n.room)p.push('moved to '+n.room);if(o.date!==n.date||o.start!==n.start)p.push('rescheduled');if(o.faculty!==n.faculty&&n.faculty)p.push('now with '+n.faculty);
  return p.length?n.title+' '+p.join(', ')+', '+when(n.date,fmtT(n.start)):''}
const os=$('save').onclick;$('save').onclick=()=>{const o=editId&&events.find(e=>e.id===editId),old=o&&{...o},ln=events.length;os();if($('err').textContent)return;
  if(old){const m=diff(old,events.find(e=>e.id===old.id)||old);if(m)note(m)}else if(events.length>ln){const n=events[events.length-1];note('New: '+n.title+', '+when(n.date,fmtT(n.start))+(n.room?' · '+n.room:''))}hero()};
const od=$('del').onclick;$('del').onclick=()=>{const w=delArm,e=events.find(x=>x.id===editId);od();if(w&&e)note('Cancelled: '+e.title+', '+when(e.date,fmtT(e.start)));hero()};
function alerts(){const h=changes.length?changes.map(c=>`<div class="ch ${c.t>seen?'new':''}"><b>${esc(c.m)}</b><small>${new Date(c.t).toLocaleString()}</small></div>`).join(''):'<p class="sub">No changes yet. Move, edit or cancel an event and it will appear here.</p>';
  dlg(`<h2>Schedule changes</h2>${h}<div class="foot"><button class="btn" id="xs">Share update</button><button class="btn primary" id="xc">Close</button></div>`);
  seen=Date.now();try{localStorage.setItem(LK,seen)}catch(e){}badge();hero();$('xc').onclick=()=>$('xm').remove();
  $('xs').onclick=()=>{const tx='Schedule update:\n'+changes.slice(0,10).map(c=>'• '+c.m).join('\n'),S=window.Capacitor?.Plugins?.Share;S?S.share({text:tx}):navigator.clipboard?.writeText(tx).then(()=>toast('Copied. Paste into your class group.'))}}

/* ---- Leave & cover ---- */
function names(){const s=new Set(events.map(e=>e.faculty));plan.classes.forEach(c=>{c.subjects.forEach(x=>s.add(x.fac));Object.values(c.tt).forEach(x=>s.add(x.fac))});s.delete('');s.delete(undefined);return[...s].sort()}
function facBusy(n,date,s,e){if(events.some(x=>x.faculty===n&&x.date===date&&!x.allDay&&x.start&&ov(x.start,x.end||x.start,s,e)))return true;const wd=DAYS[(new Date(date+'T00:00').getDay()+6)%7];return plan.classes.some(c=>c.slots.some((sl,j)=>{const y=c.tt[wd+'|'+j];return y&&y.fac===n&&ov(sl.s,sl.e,s,e)}))}
function sess(f,a,b){const o=[];events.forEach(e=>{if(e.faculty===f&&e.date>=a&&e.date<=b&&!e.allDay&&e.start)o.push({k:'e',ev:e,title:e.title,date:e.date,s:e.start,e:e.end||e.start,room:e.room})});
  for(let d=new Date(a+'T00:00'),i=0;iso(d)<=b&&i<62;d.setDate(d.getDate()+1),i++){const wd=DAYS[(d.getDay()+6)%7];if(!wd)continue;plan.classes.forEach(c=>c.slots.forEach((sl,j)=>{const y=c.tt[wd+'|'+j];if(y&&y.fac===f&&!events.some(x=>x.key==='tt:'+c.id+':'+wd+':'+j+':'+iso(d)))o.push({k:'t',title:y.sub,date:iso(d),s:sl.s,e:sl.e,room:y.room,cls:c.name})}))}
  return o.sort((x,y)=>(x.date+x.s).localeCompare(y.date+y.s))}
function cands(f,x){const t=new Set();plan.classes.forEach(c=>c.subjects.forEach(s=>{if(s.name===x.title&&s.fac)t.add(s.fac)}));events.forEach(e=>{if(e.title===x.title&&e.faculty)t.add(e.faculty)});
  return names().filter(n=>n!==f&&!facBusy(n,x.date,x.s,x.e)).sort((p,q)=>(t.has(q)-t.has(p))||p.localeCompare(q))}
function leave(){let S=[];dlg(`<h2>Leave and cover</h2><div class="field"><label>Faculty on leave</label><select id="lf">${names().map(n=>`<option>${esc(n)}</option>`).join('')}</select></div><div class="two"><div class="field"><label>From</label><input type="date" id="la" value="${todayISO()}"></div><div class="field"><label>To</label><input type="date" id="lb" value="${todayISO()}"></div></div><div id="lr"></div><div class="foot"><button class="btn" id="lx">Close</button><div class="row"><button class="btn" id="lfind">Find cover</button><button class="btn primary" id="lgo" style="display:none">Assign and notify</button></div></div>`);
  $('lx').onclick=()=>$('xm').remove();
  $('lfind').onclick=()=>{const f=$('lf').value;S=sess(f,$('la').value,$('lb').value);
    $('lr').innerHTML=S.length?S.map((x,i)=>{const c=cands(f,x);return`<div class="ch"><b>${esc(x.title)}</b><small>${esc(when(x.date,fmtT(x.s)))}${x.room?' · '+esc(x.room):''}${x.cls?' · '+esc(x.cls):''}</small><select data-i="${i}"><option value="">${c.length?'Leave uncovered':'No one is free'}</option>${c.map((n,j)=>`<option ${j==0?'selected':''}>${esc(n)}</option>`).join('')}</select></div>`}).join(''):'<p class="sub">No sessions found for that period.</p>';
    $('lgo').style.display=S.length?'':'none'};
  $('lgo').onclick=()=>{const f=$('lf').value;let n=0;$('lr').querySelectorAll('select').forEach(s=>{const x=S[+s.dataset.i],c=s.value;if(!c)return;n++;
      if(x.k==='e')x.ev.faculty=c;else events.push({id:uid(),title:x.title,faculty:c,type:'Lecture',date:x.date,start:x.s,end:x.e,allDay:false,room:x.room||'',notes:'Cover for '+f+(x.cls?' · '+x.cls:'')});
      note(`${x.title} (${when(x.date,fmtT(x.s))}) is covered by ${c} while ${f} is on leave`)});
    persist();render();$('xm').remove();toast(n+' cover'+(n==1?'':'s')+' assigned and logged')}}

/* ---- Auto-timetable ---- */
function gen(){const c=cur(),rooms=(prompt('Rooms available (comma separated, blank for none)','Room 101, Room 102')||'').split(',').map(s=>s.trim()).filter(Boolean),cap=+prompt('Max lectures per faculty per day',5)||5;
  const used=(d,i,fn)=>plan.classes.some(o=>o!==c&&o.slots.some((sl,j)=>{const y=o.tt[d+'|'+j];return y&&ov(sl.s,sl.e,c.slots[i].s,c.slots[i].e)&&fn(y)}));
  const load=(d,f)=>{let n=0;plan.classes.forEach(o=>o.slots.forEach((_,j)=>{const y=o.tt[d+'|'+j];if(y&&y.fac===f)n++}));return n};
  let ok=0,miss=0;
  c.subjects.filter(s=>s.name&&+s.lpw>0).sort((a,b)=>b.lpw-a.lpw).forEach(s=>{let need=+s.lpw-Object.values(c.tt).filter(x=>x.sub===s.name).length;
    while(need-->0){const cs=[];DAYS.forEach(d=>c.slots.forEach((sl,i)=>{const k=d+'|'+i;if(c.tt[k])return;if(s.fac&&(used(d,i,y=>y.fac===s.fac)||load(d,s.fac)>=cap))return;
      const r=rooms.find(r=>!used(d,i,y=>y.room===r));if(rooms.length&&!r)return;
      const same=c.slots.some((_,j)=>c.tt[d+'|'+j]?.sub===s.name),n=c.slots.filter((_,j)=>c.tt[d+'|'+j]).length;cs.push({k,r,sc:(same?100:0)+n*3+i})}));
      cs.sort((a,b)=>a.sc-b.sc);const p=cs[0];if(p){c.tt[p.k]={sub:s.name,fac:s.fac||'',room:p.r||''};ok++}else miss++}});
  savePlan();renderPlan();toast(`Placed ${ok} lecture${ok==1?'':'s'}`+(miss?`, ${miss} could not fit (add rooms or raise the faculty limit)`:''))}
const orp=renderPlan;renderPlan=function(){orp();const r=$('planView').querySelector('.bar .row');if(r)r.insertAdjacentHTML('beforeend','<button class="btn primary" data-xgen="1">Auto-generate timetable</button>')};
document.addEventListener('click',e=>{if(e.target.closest('[data-xgen]')){if(!cur().subjects.some(s=>s.name&&+s.lpw>0))toast('Add subjects with lectures per week first (Subjects tab)');else gen()}});

/* ---- Today hero ---- */
function hero(){const el=$('hero');if(!el)return;const n=new Date(),t=iso(n),hm=pad(n.getHours())+':'+pad(n.getMinutes());
  const up=events.filter(e=>e.date>t||(e.date===t&&(e.allDay||!e.end||e.end>=hm))).sort((a,b)=>(a.date+(a.start||'')).localeCompare(b.date+(b.start||'')))[0];
  const td=events.filter(e=>e.date===t).length,g=n.getHours()<12?'Good morning':n.getHours()<17?'Good afternoon':'Good evening',cl=clashSet().size,un=unread();
  let nx='<small>NEXT UP</small><b>Nothing scheduled</b><span>Enjoy the free time.</span>';
  if(up){let c;if(up.date===t&&up.start){const m=(+up.start.slice(0,2))*60+ +up.start.slice(3)-(n.getHours()*60+n.getMinutes());c=m<=0?'happening now':m<60?'in '+m+' min':'in '+Math.floor(m/60)+'h '+m%60+'m'}else c=when(up.date);
    nx=`<small>NEXT UP · ${esc(c)}</small><b>${esc(up.title)}</b><span>${esc([up.allDay?'All day':fmtT(up.start),up.room,up.faculty].filter(Boolean).join(' · '))}</span>`}
  el.innerHTML=`<div><h2>${g}</h2><p>${td} event${td==1?'':'s'} today${cl?` · ${cl} clash${cl>1?'es':''} to fix`:''}${un?` · ${un} new change${un>1?'s':''}`:''}</p></div><div class="nx">${nx}</div>`}
const orr=render;render=function(){orr();hero()};

/* ---- UI ---- */
const sy=document.createElement('style');sy.textContent='.hero{display:flex;flex-wrap:wrap;gap:16px;justify-content:space-between;align-items:center;padding:20px 22px;margin-bottom:14px;border-radius:16px;color:#fff;background:linear-gradient(135deg,#0f766e,#2a5db0 70%,#6b46a8)}.hero h2{margin:0;font-size:26px}.hero p{margin:4px 0 0;opacity:.9}.hero .nx{background:rgba(255,255,255,.16);border-radius:12px;padding:10px 16px;min-width:230px}.hero .nx small{display:block;letter-spacing:.08em;font-size:11px;opacity:.85}.hero .nx b{display:block;font-size:18px}.tools{margin-bottom:14px}.xm{position:fixed;inset:0;background:rgba(10,15,25,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60}.ch{padding:10px 12px;margin-bottom:8px;border:1px solid var(--line);border-radius:10px}.ch.new{border-color:var(--accent);background:var(--today)}.ch b,.ch small,.ch select{display:block}.ch small{color:var(--mute)}.ch select{margin-top:6px;width:100%;padding:7px;border:1px solid var(--line);border-radius:8px;background:var(--card)}';document.head.appendChild(sy);
const hs=document.createElement('section');hs.id='hero';hs.className='hero';
const tb=document.createElement('div');tb.className='row noprint tools';tb.innerHTML='<button class="btn primary" id="xa">Changes</button><button class="btn" id="xi">Import CSV / ICS</button><button class="btn" id="xe">Export .ics for Google / Outlook</button><button class="btn" id="xt">CSV template</button><button class="btn" id="xl">Leave and cover</button>';
$('stats').before(hs);$('stats').before(tb);
const fi=document.createElement('input');fi.type='file';fi.accept='.csv,.ics,.xlsx,text/csv,text/calendar';fi.hidden=true;document.body.appendChild(fi);
$('xa').onclick=alerts;$('xl').onclick=leave;$('xi').onclick=()=>fi.click();
$('xe').onclick=()=>out('semestersync.ics','text/calendar',toICS(filtered()));
$('xt').onclick=()=>out('semestersync-template.csv','text/csv','Date,Start,End,Title,Type,Faculty,Room,Notes\n'+todayISO()+',09:00,10:00,Physics Lecture,Lecture,Dr. Rao,Room 204,Bring lab coat\n');
fi.onchange=async()=>{const f=fi.files[0];if(!f)return;const t=/\.xlsx$/i.test(f.name)?await window.xlsxToCSV(f):await f.text();fi.value='';const list=/\.ics$/i.test(f.name)||t.includes('BEGIN:VCALENDAR')?fromICS(t):fromCSV(t);
  const have=new Set(events.map(e=>e.date+e.start+e.title)),add=list.filter(e=>!have.has(e.date+e.start+e.title));events.push(...add);persist();render();
  toast(`Imported ${add.length} event${add.length==1?'':'s'}`+(list.length>add.length?`, skipped ${list.length-add.length} duplicates`:'')+(list.length?'':'. Nothing valid found. Use the CSV template (dates as YYYY-MM-DD).'));if(add.length)note(`${add.length} events imported from ${f.name}`)};
window.SS={fromICS,fromCSV,toast,note,dlg,diff,when,out};badge();hero();setInterval(hero,30000);
})();
