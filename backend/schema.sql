-- Run in Supabase: SQL Editor. Orgs, roles (admin/faculty/student), departments, events, sync docs, calendar feeds.
create table orgs(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz default now());
create table members(org_id uuid references orgs on delete cascade,user_id uuid references auth.users on delete cascade,role text not null check(role in('admin','faculty','student')),dept text,primary key(org_id,user_id));
create table invites(code text primary key default substr(md5(random()::text),1,8),org_id uuid references orgs on delete cascade,role text not null,dept text);
create table events(id uuid primary key,org_id uuid not null references orgs on delete cascade,dept text,data jsonb not null default '{}',deleted bool default false,updated_at timestamptz default now());
create table docs(org_id uuid references orgs on delete cascade,key text,data jsonb,updated_at timestamptz default now(),primary key(org_id,key));
create table feeds(token uuid primary key default gen_random_uuid(),org_id uuid references orgs on delete cascade,user_id uuid references auth.users on delete cascade,unique(org_id,user_id));
create index on events(org_id,updated_at);
create function touch() returns trigger language plpgsql as $$begin new.updated_at=now();return new;end$$;
create trigger t1 before insert or update on events for each row execute function touch();
create trigger t2 before insert or update on docs for each row execute function touch();
create function my_role(o uuid) returns text language sql security definer stable set search_path=public as $$select role from members where org_id=o and user_id=auth.uid()$$;
create function my_dept(o uuid) returns text language sql security definer stable set search_path=public as $$select dept from members where org_id=o and user_id=auth.uid()$$;
do $$declare t text;begin foreach t in array array['orgs','members','invites','events','docs','feeds'] loop execute format('alter table %I enable row level security',t);end loop;end$$;
create policy o_r on orgs for select using(my_role(id) is not null);
create policy m_r on members for select using(my_role(org_id) is not null);
create policy e_r on events for select using(my_role(org_id)='admin' or (my_role(org_id) is not null and (dept is null or dept=my_dept(org_id))));
create policy e_w on events for all using(my_role(org_id)='admin' or (my_role(org_id)='faculty' and (dept is null or dept=my_dept(org_id)))) with check(my_role(org_id)='admin' or (my_role(org_id)='faculty' and (dept is null or dept=my_dept(org_id))));
create policy d_r on docs for select using(my_role(org_id) is not null);
create policy d_w on docs for all using(my_role(org_id) in('admin','faculty')) with check(my_role(org_id) in('admin','faculty'));
create function create_org(n text) returns uuid language plpgsql security definer set search_path=public as $$declare o uuid;begin insert into orgs(name)values(n)returning id into o;insert into members values(o,auth.uid(),'admin',null);return o;end$$;
create function make_invite(r text,d text default null) returns text language plpgsql security definer set search_path=public as $$declare o uuid;c text;begin select org_id into o from members where user_id=auth.uid() and role='admin' limit 1;if o is null then raise exception 'Admins only';end if;insert into invites(org_id,role,dept)values(o,r,d)returning code into c;return c;end$$;
create function join_org(c text) returns void language plpgsql security definer set search_path=public as $$begin insert into members(org_id,user_id,role,dept)select org_id,auth.uid(),role,dept from invites where code=c on conflict do nothing;if not found then raise exception 'Invalid invite code';end if;end$$;
create function my_feed() returns uuid language plpgsql security definer set search_path=public as $$declare o uuid;t uuid;begin select org_id into o from members where user_id=auth.uid() limit 1;if o is null then raise exception 'Join an organisation first';end if;insert into feeds(org_id,user_id)values(o,auth.uid())on conflict(org_id,user_id)do nothing;select token into t from feeds where org_id=o and user_id=auth.uid();return t;end$$;

-- ===== v5 additions (existing projects: run only this block) =====
create table audit(id bigserial primary key,org_id uuid,user_id uuid,event_id uuid,action text,old jsonb,new jsonb,at timestamptz default now());
alter table audit enable row level security;
create policy a_r on audit for select using(my_role(org_id)='admin');
create function log_ev() returns trigger language plpgsql security definer set search_path=public as $$begin insert into audit(org_id,user_id,event_id,action,old,new)values(new.org_id,auth.uid(),new.id,case when tg_op='INSERT' then 'create' when new.deleted then 'delete' else 'update' end,case when tg_op='UPDATE' then old.data end,new.data);return new;end$$;
create trigger t3 after insert or update on events for each row execute function log_ev();
create function delete_me() returns void language plpgsql security definer set search_path=public,auth as $$begin delete from auth.users where id=auth.uid();end$$;
