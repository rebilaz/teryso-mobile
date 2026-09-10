-- Append inside the migration transaction, replacing its COMMIT; then ROLLBACK.
-- Only synthetic accounts are used. No mail or Auth Admin API call is made.
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data)
values ('10000000-0000-4000-8000-000000000001','mobile-safety-a@example.invalid','{}','{}'),
       ('10000001-0000-4000-8000-000000000002','mobile-safety-b@example.invalid','{}','{}');
insert into public.portfolios(id,user_id,name,slug,is_public,governance_mode,base_currency)
values('20000000-0000-4000-8000-000000000001','10000001-0000-4000-8000-000000000002','Safety test','mobile-safety-test',true,'owner','EUR');
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
  begin
    update public.profiles set display_name='Must fail' where id=auth.uid();
    raise exception 'TEST FAILED: publication allowed without consent';
  exception when insufficient_privilege then null; end;
end $$;
select public.accept_community_terms('2026-09-10');
update public.profiles set display_name='Accepted' where id=auth.uid();
select public.submit_content_report('portfolio','20000000-0000-4000-8000-000000000001','Test report','Synthetic transaction-only test');
do $$ begin
  if not exists(select 1 from public.portfolios where id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: public content invisible before block'; end if;
  begin
    perform public.review_content_report(gen_random_uuid(),'removed','test','client');
    raise exception 'TEST FAILED: client can moderate';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.account_deletion_files(auth.uid());
    raise exception 'TEST FAILED: client can read privileged storage manifest';
  exception when insufficient_privilege then null; end;
end $$;
select public.block_user('10000001-0000-4000-8000-000000000002');
do $$ begin
  if exists(select 1 from public.portfolios where id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: blocked portfolio visible'; end if;
  begin
    perform public.get_mobile_portfolio_snapshot('20000000-0000-4000-8000-000000000001');
    raise exception 'TEST FAILED: blocked snapshot visible';
  exception when insufficient_privilege then null; end;
end $$;
delete from public.user_blocks where blocker_id=auth.uid();
reset role;
select public.review_content_report(id,'removed','Synthetic removal test','automated-transaction-test') from public.content_reports where reporter_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if exists(select 1 from public.portfolios where id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: removed portfolio visible'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
delete from auth.users where id='10000001-0000-4000-8000-000000000002';
do $$ begin
  if exists(select 1 from public.portfolios where id='20000000-0000-4000-8000-000000000001') then raise exception 'TEST FAILED: orphan portfolio after account deletion'; end if;
  if exists(select 1 from public.profiles where id='10000001-0000-4000-8000-000000000002') then raise exception 'TEST FAILED: orphan profile'; end if;
end $$;
select 'PASS: consent, reporting, block, moderation authorization, visibility, deletion cleanup' as result;
rollback;
