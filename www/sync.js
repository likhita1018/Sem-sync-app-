/* SemesterSync v4: accounts, roles, cloud sync, Excel + calendar-link import, native reminders */
(()=>{
const cfg=window.SS_CFG||{},{fromICS,toast,note,dlg,diff,when}=window.SS,UU=/^[0-9a-f]{8}-[0-9a-f]{4}-/,E0='1970-01-01T00:00:00Z',pad=n=>String(n).padStart(2,'0'),PS=()=>localStorage.getItem('semestersync.plan.v1')||'';
const ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch(e){return d}};
let S=ls('ss.s',null),M=null,busy=false,tm=0,snap=ls('ss.snap',{}),last=localStorage.getItem('ss.last')||E0,plast=localStorage.getItem('ss.pl')||E0,pstr=localStorage.getItem('ss.ps');
const sv=()=>{try{localStorage.setItem('ss.s',JSON.stringify(S));localStorage.setItem('ss.snap',JSON.stringify(snap));localStorage.setItem('ss.last',last);localStorage.setItem('ss.pl',plast);pstr==null?localStorage.removeItem('ss.ps'):localStorage.setItem('ss.ps',pstr)}catch(e){}};
async function api(p,o={},auth=true){const r=await fetch(cfg.url+p,{...o,headers:{apikey:cfg.anon,Authorization:'Bearer '+((auth&&S&&S.tok)||cfg.anon),'Content-Type':'application/json',...(o.headers||{})}}),t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch(e){}
  if(!r.ok)throw new Error(j?.msg||j?.message||j?.error_description||'Error '+r.status);return j}
const post=(p,b,h)=>api(p,{method:'POST',body:JSON.stringify(b),headers:h});
function ses(j){S={tok:j.access_token,rt:j.refresh_token,exp:j.expires_at||Math.floor(Date.now()/1e3)+j.expires_in,uid:j.user.id,email:j.user.email};sv()}
async function tok(){if(S&&S.exp<Date.now()/1e3+60)ses(await post('/auth/v1/token?grant_type=refresh_token',{refresh_token:S.rt},{}))}
async function login(em,pw,up){if(up){const j=await post('/auth/v1/signup',{email:em,password:pw});if(j.access_token)return ses(j);throw new Error('Check your email to confirm the account, then sign in.')}ses(await post('/auth/v1/token?grant_type=password',{email:em,password:pw}))}
async function mem(){const r=await api('/rest/v1/members?select=org_id,role,dept,orgs(name)&user_id=eq.'+S.uid+'&limit=1');M=r[0]||null;document.body.classList.toggle('ro',!!M&&M.role==='student')}
const fp=e=>JSON.stringify(e);
async function sync(){if(!S||!M||busy)return;busy=true;try{await tok();const o=M.org_id,ro=M.role==='student',first=last===E0;
  const rows=await api(`/rest/v1/events?org_id=eq.${o}&updated_at=gt.${encodeURIComponent(ro?E0:last)}&select=id,data,deleted,updated_at&order=updated_at`);
  if(first&&rows.some(r=>!r.deleted)){events.length=0;snap={}}
  let ch=0;rows.forEach(r=>{const i=events.findIndex(e=>e.id===r.id),old=i>=0?events[i]:null;
    if(r.deleted){if(old){events.splice(i,1);ch++;if(!first)note('Cancelled: '+old.title+', '+when(old.date,fmtT(old.start)))}delete snap[r.id]}
    else if(!old||fp(old)!==fp(r.data)){if(!first){const m=old?diff(old,r.data):'New: '+r.data.title+', '+when(r.data.date,fmtT(r.data.start));if(m)note(m)}old?events[i]=r.data:events.push(r.data);snap[r.id]=fp(r.data);ch++}
    else snap[r.id]=fp(old);if(r.updated_at>last)last=r.updated_at});
  if(ch){persistRaw();render()}
  if(!ro){const up=[],ids=new Set();events.forEach(e=>{if(!UU.test(e.id))return;ids.add(e.id);if(snap[e.id]!==fp(e))up.push({id:e.id,org_id:o,dept:e.dept||null,data:e,deleted:false})});
    Object.keys(snap).forEach(id=>{if(!ids.has(id))up.push({id,org_id:o,data:{},deleted:true})});
    if(up.length){await post('/rest/v1/events?on_conflict=id',up,{Prefer:'resolution=merge-duplicates'});up.forEach(u=>u.deleted?delete snap[u.id]:snap[u.id]=fp(u.data))}}
  const d=(await api(`/rest/v1/docs?org_id=eq.${o}&key=eq.plan&select=data,updated_at`))[0];
  if(!ro&&(!d||(pstr!==null&&PS()!==pstr))){const r=await post('/rest/v1/docs?on_conflict=org_id,key',{org_id:o,key:'plan',data:plan},{Prefer:'resolution=merge-duplicates,return=representation'});plast=r[0].updated_at;pstr=PS()}
  else if(d&&(pstr===null||d.updated_at>plast)){plan=d.data;if(!plan.classes.some(c=>c.id===plan.sel))plan.sel=plan.classes[0]?.id;savePlan();plast=d.updated_at;pstr=PS();renderPlan()}
  sv()}catch(e){console.warn('sync',e)}busy=false}
const persistRaw=persist;persist=function(){persistRaw();clearTimeout(tm);tm=setTimeout(sync,1500)};

/* ---- Account UI ---- */
function acct(){const X=h=>{dlg('<h2>Account and sync</h2>'+h+'<div class="foot"><span></span><button class="btn" id="xc2">Close</button></div>');$('xc2').onclick=()=>$('xm').remove()},
  err=e=>toast(e.message||String(e)),f=(id,l,t='text')=>`<div class="field"><label>${l}</label><input id="${id}" type="${t}"></div>`,re=()=>init().then(acct).catch(err);
  if(!cfg.url)return X('<p class="sub">Backend not connected yet. Fill in config.js (see SETUP.md) and rebuild.</p>');
  if(!S){X(f('ae','Email','email')+f('ap','Password','password')+'<div class="row"><button class="btn primary" id="ai">Sign in</button><button class="btn" id="au">Create account</button></div><div class="row"><button class="btn" id="og">Continue with Google</button><button class="btn" id="om">Continue with Microsoft</button></div>');
    const go=up=>login($('ae').value.trim(),$('ap').value,up).then(re).catch(err);$('ai').onclick=()=>go(0);$('au').onclick=()=>go(1);$('og').onclick=()=>sso('google');$('om').onclick=()=>sso('azure');return}
  if(!M){X('<p>Signed in as '+esc(S.email)+'</p>'+f('on','New organisation name')+'<button class="btn primary" id="oc">Create organisation</button>'+f('jc','Or join with an invite code')+'<button class="btn" id="oj">Join</button>');
    $('oc').onclick=()=>post('/rest/v1/rpc/create_org',{n:$('on').value.trim()}).then(re).catch(err);$('oj').onclick=()=>post('/rest/v1/rpc/join_org',{c:$('jc').value.trim()}).then(re).catch(err);return}
  X(`<p><b>${esc(M.orgs?.name||'')}</b> · ${esc(M.role)}${M.dept?' · '+esc(M.dept):''}<br><small>${esc(S.email)}</small></p><div class="row"><button class="btn primary" id="sn">Sync now</button><button class="btn" id="sf">Copy calendar feed link</button><button class="btn" id="so">Sign out</button><button class="btn" id="ex">Export my data</button><button class="btn" id="dx">Delete account</button></div>`+(M.role==='admin'?'<hr><div class="two"><div class="field"><label>Invite role</label><select id="ir"><option>student</option><option>faculty</option><option>admin</option></select></div>'+f('id','Department (optional)')+'</div><button class="btn" id="ic">Create invite code</button><p id="ik"></p>':''));
  $('sn').onclick=()=>sync().then(()=>toast('Synced'));$('ex').onclick=()=>window.SS.out('semestersync-my-data.json','application/json',JSON.stringify({account:S.email,org:M,events,plan,personal:ls('ss.st',{})},null,1));$('dx').onclick=()=>{if(confirm('Delete your account permanently? This cannot be undone.'))post('/rest/v1/rpc/delete_me',{}).then(()=>$('so').onclick()).catch(err)};
  $('sf').onclick=()=>post('/rest/v1/rpc/my_feed',{}).then(t=>{navigator.clipboard?.writeText(cfg.url+'/functions/v1/ics?t='+t);toast('Feed link copied. Google Calendar: Other calendars > From URL. Outlook: Add calendar > Subscribe from web.')}).catch(err);
  $('so').onclick=()=>{S=null;M=null;snap={};last=E0;plast=E0;pstr=null;document.body.classList.remove('ro');sv();ab();$('xm').remove()};
  if($('ic'))$('ic').onclick=()=>post('/rest/v1/rpc/make_invite',{r:$('ir').value,d:$('id').value.trim()||null}).then(c=>{$('ik').textContent='Invite code: '+c}).catch(err)}
const ab=()=>{$('xu').textContent=S?(M?M.role+' · synced':'Account'):'Sign in'};
const sso=p=>{location.href=cfg.url+'/auth/v1/authorize?provider='+p+'&redirect_to='+encodeURIComponent(location.origin+location.pathname)};
async function hashLogin(){if(!cfg.url||!/access_token=/.test(location.hash))return;const p=new URLSearchParams(location.hash.slice(1));history.replaceState(null,'',location.pathname);try{const u=await api('/auth/v1/user',{headers:{Authorization:'Bearer '+p.get('access_token')}},false);ses({access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),expires_in:+p.get('expires_in')||3600,user:u})}catch(e){}}
async function init(){await hashLogin();if(!S||!cfg.url)return ab();try{await tok();await mem();await sync()}catch(e){}ab()}

/* ---- Excel (.xlsx) reader, no library: ZIP + DecompressionStream ---- */
window.xlsxToCSV=async file=>{const b=new Uint8Array(await file.arrayBuffer()),dv=new DataView(b.buffer);let e=b.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)throw new Error('Not an .xlsx file');
  let p=dv.getUint32(e+16,true);const n=dv.getUint16(e+10,true),F={},td=new TextDecoder();
  for(let i=0;i<n;i++){const nl=dv.getUint16(p+28,true);F[td.decode(b.subarray(p+46,p+46+nl))]={m:dv.getUint16(p+10,true),cs:dv.getUint32(p+20,true),lo:dv.getUint32(p+42,true)};p+=46+nl+dv.getUint16(p+30,true)+dv.getUint16(p+32,true)}
  const rd=async k=>{const z=F[k];if(!z)return'';const o=z.lo+30+dv.getUint16(z.lo+26,true)+dv.getUint16(z.lo+28,true),d=b.subarray(o,o+z.cs);return z.m===0?td.decode(d):new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()};
  const P=x=>new DOMParser().parseFromString(x,'text/xml'),ss=[...P(await rd('xl/sharedStrings.xml')).getElementsByTagName('si')].map(s=>[...s.getElementsByTagName('t')].map(t=>t.textContent).join('')),
    wn=Object.keys(F).filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort()[0],rows=[];
  [...P(await rd(wn)).getElementsByTagName('row')].forEach(r=>{const a=[];[...r.getElementsByTagName('c')].forEach(c=>{const col=[...(c.getAttribute('r')||'A').replace(/\d+/,'')].reduce((x,ch)=>x*26+ch.charCodeAt(0)-64,0)-1,t=c.getAttribute('t'),v=c.getElementsByTagName('v')[0]?.textContent??'';a[col]=t==='s'?ss[+v]:t==='inlineStr'?c.textContent:v});rows.push(a)});
  const h=(rows[0]||[]).map(x=>String(x||'').trim().toLowerCase()),q=v=>'"'+String(v).replace(/"/g,'""')+'"',
    fx=(k,v)=>{if(v==null||v===''||isNaN(+v))return v??'';const x=+v;if(k==='date')return new Date(Date.UTC(1899,11,30)+Math.floor(x)*864e5).toISOString().slice(0,10);if(k==='start'||k==='end'){const m=Math.round((x%1)*1440);return pad(m/60|0)+':'+pad(m%60)}return v};
  return[h.map(q).join(',')].concat(rows.slice(1).map(r=>h.map((k,i)=>q(fx(k,r[i]))).join(','))).join('\n')};

/* ---- Calendar link import (Moodle, Canvas, Google secret iCal address, Outlook) ---- */
async function importUrl(){const u=prompt('Paste a calendar link (Moodle/Canvas export link, Google "secret address in iCal format", Outlook ICS)');if(!u)return;
  try{const r=await fetch(u.trim().replace(/^webcal:/i,'https:')),l=fromICS(await r.text()),have=new Set(events.map(e=>e.date+e.start+e.title)),add=l.filter(e=>!have.has(e.date+e.start+e.title));
    events.push(...add);persist();render();toast(`Imported ${add.length} of ${l.length} events`);if(add.length)note(add.length+' events imported from a calendar link')}
  catch(e){toast('Could not fetch that link. In the Android app, enable CapacitorHttp (see SETUP.md).')}}

/* ---- Native reminders: 15 min before each upcoming class ---- */
let rt=0;async function remind(){const L=window.Capacitor?.Plugins?.LocalNotifications;if(!L)return;try{let p=await L.checkPermissions();if(p.display!=='granted')p=await L.requestPermissions();if(p.display!=='granted')return;
  const pend=(await L.getPending()).notifications.filter(n=>n.id<=200);if(pend.length)await L.cancel({notifications:pend});const now=Date.now();
  const list=events.filter(e=>e.start&&!e.allDay).map(e=>({e,at:new Date(e.date+'T'+e.start).getTime()-9e5})).filter(x=>x.at>now&&x.at<now+14*864e5).sort((a,b)=>a.at-b.at).slice(0,60);
  if(list.length)await L.schedule({notifications:list.map((x,i)=>({id:i+1,title:x.e.title,body:fmtT(x.e.start)+(x.e.room?' · '+x.e.room:''),schedule:{at:new Date(x.at),allowWhileIdle:true}}))})}catch(e){}}
const orr=render;render=function(){orr();clearTimeout(rt);rt=setTimeout(remind,2500)};

/* ---- UI ---- */
const sy=document.createElement('style');sy.textContent='body.ro #add,body.ro #save,body.ro #del,body.ro #xl,body.ro #xi,body.ro #xk,body.ro [data-xgen]{display:none!important}';document.head.appendChild(sy);
const tl=document.querySelector('.tools');tl.insertAdjacentHTML('afterbegin','<button class="btn primary" id="xu">Sign in</button>');tl.insertAdjacentHTML('beforeend','<button class="btn" id="xk">Import calendar link</button>');
$('xu').onclick=acct;$('xk').onclick=importUrl;$('xi').title='CSV, Excel (.xlsx) or ICS';$('xi').textContent='Import Excel / CSV / ICS';
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync()});setInterval(sync,20000);init();remind();
})();
