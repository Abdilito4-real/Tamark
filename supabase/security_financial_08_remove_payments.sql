begin;

drop function if exists public.finalize_verified_payment(text);
drop function if exists public.submit_paid_application(uuid);
drop function if exists public.admin_payment_summary();
drop function if exists public.record_refund_provider_result(uuid, text, text, jsonb);
drop function if exists public.claim_paystack_webhook_event(text, text, text, text);

do $$
begin
  if to_regclass('public.payments') is not null then
    execute 'drop trigger if exists payments_status_transition on public.payments';
  end if;
  if to_regclass('public.notifications') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public'
         and table_name = 'notifications'
         and column_name = 'payment_reference'
     ) then
    execute 'delete from public.notifications where payment_reference is not null';
  end if;
  if to_regclass('public.audit_logs') is not null then
    execute $query$
      delete from public.audit_logs
      where event_type like 'payment.%' or event_type like 'refund.%'
    $query$;
  end if;
end;
$$;

drop index if exists public.notifications_payment_reference_unique_idx;
alter table public.notifications drop column if exists payment_reference;

drop table if exists public.refunds;
drop table if exists public.payments;
drop table if exists public.paystack_webhook_events;
drop function if exists public.enforce_payment_status_transition();
drop type if exists public.payment_status;

alter table public.programmes
  drop column if exists price_minor,
  drop column if exists price_approved,
  drop column if exists currency;

commit;
