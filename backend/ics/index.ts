// Deploy: supabase functions deploy ics --no-verify-jwt   (subscribable calendar feed, one link per user)
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
const ie=(s:string)=>String(s||'').replace(/[\\;,]/g,'\\$&').replace(/\n/g,'\\n'),st=(d:string,t?:string)=>d.replace(/-/g,'')+(t?'T'+t.replace(':','')+'00':'');
Deno.serve(async req=>{
  const t=new URL(req.url).searchParams.get('t')||'',db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const{data:f}=await db.from('feeds').select('org_id,user_id').eq('token',t).maybeSingle();if(!f)return new Response('Not found',{status:404});
  const{data:m}=await db.from('members').select('role,dept').eq('org_id',f.org_id).eq('user_id',f.user_id).single();if(!m)return new Response('Not found',{status:404});
  let q=db.from('events').select('id,data').eq('org_id',f.org_id).eq('deleted',false);if(m.role!=='admin')q=q.or(m.dept?`dept.is.null,dept.eq.${m.dept}`:'dept.is.null');
  const{data:rows}=await q,ts=new Date().toISOString().replace(/[-:]|\.\d+/g,''),L=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SemesterSync//EN','X-WR-CALNAME:SemesterSync','REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  (rows||[]).forEach(({id,data:e})=>{if(!e.date)return;L.push('BEGIN:VEVENT','UID:'+id+'@semestersync','DTSTAMP:'+ts);
    if(e.allDay||!e.start)L.push('DTSTART;VALUE=DATE:'+st(e.date));else L.push('DTSTART:'+st(e.date,e.start),'DTEND:'+st(e.date,e.end||e.start));
    L.push('SUMMARY:'+ie(e.title),'LOCATION:'+ie(e.room),'DESCRIPTION:'+ie((e.faculty?e.faculty+'. ':'')+(e.notes||'')),'END:VEVENT')});
  L.push('END:VCALENDAR');return new Response(L.join('\r\n'),{headers:{'Content-Type':'text/calendar; charset=utf-8'}})});
