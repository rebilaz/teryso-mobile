-- Reviewed against the existing Teryso schema. Apply as one transaction.
-- CLI migration generation was unavailable in this environment; import this
-- file into a CLI-generated migration before deploying through your pipeline.
begin;
create schema if not exists private;

create table public.community_acceptances (
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  accepted_at timestamptz not null default now(),
  primary key (user_id, version)
);
alter table public.community_acceptances enable row level security;
grant select on public.community_acceptances to authenticated;
create policy acceptance_read_own on public.community_acceptances for select to authenticated using (user_id = (select auth.uid()));

create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked on public.user_blocks(blocked_id);
alter table public.user_blocks enable row level security;
grant select, delete on public.user_blocks to authenticated;
create policy blocks_read_own on public.user_blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_delete_own on public.user_blocks for delete to authenticated using (blocker_id = (select auth.uid()));

create table private.community_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);
create table private.hidden_content (
  kind text not null check (kind in ('portfolio','profile','proposal','rule')),
  target_id uuid not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (kind, target_id)
);
create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('portfolio','profile','proposal','rule')),
  target_id uuid not null,
  target_user_id uuid references auth.users(id) on delete set null,
  reason text not null check (length(reason) between 1 and 200),
  details text not null default '' check (length(details) <= 2000),
  status text not null default 'pending' check (status in ('pending','dismissed','removed','suspended')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  decision text,
  moderator text
);
create index content_reports_queue on public.content_reports(status, created_at);
create index content_reports_reporter on public.content_reports(reporter_id, created_at);
create index content_reports_target_user on public.content_reports(target_user_id);
alter table public.content_reports enable row level security;
-- Reports include sensitive accusations: no client SELECT/UPDATE access.
revoke all on public.content_reports from anon, authenticated;
grant all on public.content_reports to service_role;
alter table private.community_suspensions enable row level security;
alter table private.hidden_content enable row level security;

create function private.community_visible(p_kind text, p_id uuid, p_author uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from private.hidden_content where kind=p_kind and target_id=p_id)
    and not exists (select 1 from private.community_suspensions where user_id=p_author)
    and not exists (select 1 from public.user_blocks where blocker_id=auth.uid() and blocked_id=p_author);
$$;
revoke all on function private.community_visible(text,uuid,uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.community_visible(text,uuid,uuid) to anon, authenticated, service_role;

create function private.require_community_member()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from auth.users where id=auth.uid()) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if exists (select 1 from private.community_suspensions where user_id=auth.uid()) then
    raise exception 'Account suspended' using errcode='42501';
  end if;
  if not exists (select 1 from public.community_acceptances where user_id=auth.uid() and version='2026-09-10') then
    raise exception 'Accept the current community terms before publishing' using errcode='42501';
  end if;
end;
$$;
revoke all on function private.require_community_member() from public;
grant execute on function private.require_community_member() to authenticated;

create function private.accept_community_terms(p_version text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid()) then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_version is distinct from '2026-09-10' then raise exception 'Unknown terms version'; end if;
  insert into public.community_acceptances(user_id,version) values(auth.uid(),p_version) on conflict do nothing;
end;
$$;
revoke all on function private.accept_community_terms(text) from public;
grant execute on function private.accept_community_terms(text) to authenticated;
create function public.accept_community_terms(p_version text) returns void language sql security invoker set search_path='' as $$ select private.accept_community_terms(p_version); $$;
revoke all on function public.accept_community_terms(text) from public;
grant execute on function public.accept_community_terms(text) to authenticated;

create function private.block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_user_id is null or auth.uid()=p_user_id then raise exception 'Invalid block' using errcode='42501'; end if;
  insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),p_user_id) on conflict do nothing;
  delete from public.user_follows where (follower_id=auth.uid() and following_id=p_user_id) or (follower_id=p_user_id and following_id=auth.uid());
end;
$$;
revoke all on function private.block_user(uuid) from public;
grant execute on function private.block_user(uuid) to authenticated;
create function public.block_user(p_user_id uuid) returns void language sql security invoker set search_path='' as $$ select private.block_user(p_user_id); $$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create function public.submit_content_report(p_kind text, p_target_id uuid, p_reason text, p_details text default '')
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_author uuid;
begin
  -- Resolve through RLS first. Callers cannot report private, inaccessible IDs.
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  case p_kind
    when 'portfolio' then select user_id into v_author from public.portfolios where id=p_target_id;
    when 'profile' then select id into v_author from public.profiles where id=p_target_id;
    when 'proposal' then select author_id into v_author from public.governance_proposals where id=p_target_id;
    when 'rule' then select created_by into v_author from public.portfolio_rules where id=p_target_id;
    else raise exception 'Invalid content type';
  end case;
  if not found then raise exception 'Content unavailable' using errcode='42501'; end if;
  return private.store_content_report(p_kind,p_target_id,v_author,p_reason,p_details);
end;
$$;

create function private.store_content_report(p_kind text,p_target_id uuid,p_author uuid,p_reason text,p_details text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  if (select count(*) from public.content_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour') >= 20 then raise exception 'Too many reports. Try again later.'; end if;
  insert into public.content_reports(reporter_id,kind,target_id,target_user_id,reason,details)
    values(auth.uid(),p_kind,p_target_id,p_author,trim(p_reason),coalesce(p_details,'')) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.store_content_report(text,uuid,uuid,text,text) from public;
grant execute on function private.store_content_report(text,uuid,uuid,text,text) to authenticated;
revoke all on function public.submit_content_report(text,uuid,text,text) from public;
grant execute on function public.submit_content_report(text,uuid,text,text) to authenticated;

-- Restrictive policies preserve the existing ownership/member checks.
create policy mobile_profile_safety on public.profiles as restrictive for select to anon,authenticated
  using(id=auth.uid() or private.community_visible('profile',id,id));
create policy mobile_portfolio_safety on public.portfolios as restrictive for select to anon,authenticated
  using(user_id=auth.uid() or private.community_visible('portfolio',id,user_id));
create policy mobile_proposal_safety on public.governance_proposals as restrictive for select to anon,authenticated
  using(private.community_visible('proposal',id,author_id));
create policy mobile_rule_safety on public.portfolio_rules as restrictive for select to anon,authenticated
  using(private.community_visible('rule',id,created_by));

create function private.enforce_community_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  -- Internal jobs without a user JWT remain supported. A JWT-bearing RPC is
  -- still checked even when the existing RPC is SECURITY DEFINER.
  if auth.uid() is not null then perform private.require_community_member(); end if;
  return new;
end;
$$;
revoke all on function private.enforce_community_publication() from public;
create trigger community_profile_publication before update of display_name,bio,is_public on public.profiles for each row execute function private.enforce_community_publication();
create trigger community_portfolio_publication before insert or update of name,description,is_public on public.portfolios for each row execute function private.enforce_community_publication();
create trigger community_proposal_publication before insert or update on public.governance_proposals for each row execute function private.enforce_community_publication();
create trigger community_rule_publication before insert or update on public.portfolio_rules for each row execute function private.enforce_community_publication();
create trigger community_comment_publication before insert or update on public.portfolio_comments for each row execute function private.enforce_community_publication();
create trigger community_vote_publication before insert or update on public.governance_votes for each row execute function private.enforce_community_publication();

create function public.get_mobile_discover_portfolios(p_limit integer default 30)
returns TABLE(id uuid, user_id uuid, slug text, name text, description text, base_currency text, category_slug text, governance_mode text, updated_at timestamptz, owner_username text, owner_display_name text, owner_avatar_url text, followers bigint, positions_count bigint, trades_month bigint, performance_1m numeric, performance_3m numeric, performance_max numeric, volatility numeric, chart_points jsonb)
language sql stable security invoker set search_path='' as $$
  select d.id,d.user_id,d.slug,d.name,d.description,d.base_currency,d.category_slug,d.governance_mode,d.updated_at,
    case when p.is_public then d.owner_username end,
    case when p.is_public then d.owner_display_name end,
    case when p.is_public then d.owner_avatar_url end,
    d.followers,d.positions_count,d.trades_month,d.performance_1m,d.performance_3m,d.performance_max,d.volatility,d.chart_points
  from public.get_public_discover_portfolios(100) d
  left join public.profiles p on p.id=d.user_id
  where private.community_visible('portfolio',d.id,d.user_id)
    and private.community_visible('profile',d.user_id,d.user_id)
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;
revoke all on function public.get_mobile_discover_portfolios(integer) from public;
grant execute on function public.get_mobile_discover_portfolios(integer) to authenticated;

create function public.get_mobile_portfolio_snapshot(p_portfolio_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
  if not exists(select 1 from public.portfolios where id=p_portfolio_id and is_public and private.community_visible('portfolio',id,user_id)) then
    raise exception 'Portfolio unavailable' using errcode='42501';
  end if;
  return public.get_public_portfolio_snapshot(p_portfolio_id);
end;
$$;
revoke all on function public.get_mobile_portfolio_snapshot(uuid) from public;
grant execute on function public.get_mobile_portfolio_snapshot(uuid) to authenticated;

-- Supabase Table Editor provides the restricted moderation queue. Decisions
-- are made through this service-only function, never by editing client claims.
create function public.review_content_report(p_report_id uuid,p_action text,p_decision text,p_moderator text)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.content_reports;
begin
  if p_action not in ('dismissed','removed','suspended') or length(trim(p_decision))<3 or length(trim(p_moderator))<1 then raise exception 'Decision and moderator required'; end if;
  select * into strict r from public.content_reports where id=p_report_id for update;
  if p_action='removed' then
    insert into private.hidden_content(kind,target_id,reason) values(r.kind,r.target_id,p_decision) on conflict(kind,target_id) do update set reason=excluded.reason;
  elsif p_action='suspended' then
    if r.target_user_id is null then raise exception 'No user to suspend'; end if;
    insert into private.community_suspensions(user_id,reason) values(r.target_user_id,p_decision) on conflict(user_id) do update set reason=excluded.reason;
  end if;
  update public.content_reports set status=p_action,decision=p_decision,moderator=p_moderator,reviewed_at=now() where id=p_report_id;
end;
$$;
revoke all on function public.review_content_report(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_content_report(uuid,text,text,text) to service_role;
grant all on private.hidden_content,private.community_suspensions to service_role;
create policy hidden_service on private.hidden_content to service_role using(true) with check(true);
create policy suspensions_service on private.community_suspensions to service_role using(true) with check(true);

-- Auth deletion and relational cleanup share a transaction. In particular,
-- portfolios.user_id currently has NO foreign key to auth.users.
create function private.cleanup_deleted_account()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  delete from public.portfolios where user_id=old.id;
  delete from public.portfolio_rules where created_by=old.id;
  delete from public.portfolio_invitations where lower(invited_email)=lower(old.email);
  delete from public.content_reports where reporter_id=old.id or target_user_id=old.id;
  return old;
end;
$$;
revoke all on function private.cleanup_deleted_account() from public;
create trigger cleanup_deleted_account before delete on auth.users for each row execute function private.cleanup_deleted_account();

create function private.account_deletion_files(p_user_id uuid)
returns table(bucket_id text,name text) language sql stable security definer set search_path='' as $$
  select o.bucket_id,o.name from storage.objects o
  where o.owner_id=p_user_id::text or (o.bucket_id='transaction-imports' and o.name in (select storage_path from public.transaction_imports where user_id=p_user_id))
  order by o.bucket_id,o.name limit 100;
$$;
revoke all on function private.account_deletion_files(uuid) from public,anon,authenticated;
grant execute on function private.account_deletion_files(uuid) to service_role;
create function public.account_deletion_files(p_user_id uuid) returns table(bucket_id text,name text) language sql stable security invoker set search_path='' as $$ select * from private.account_deletion_files(p_user_id); $$;
revoke all on function public.account_deletion_files(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_files(uuid) to service_role;
commit;
