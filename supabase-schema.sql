create table if not exists public.app_kv (
  app text not null,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  primary key (app, key)
);

grant select, insert, update, delete on public.app_kv to anon;
grant select, insert, update, delete on public.app_kv to authenticated;

alter table public.app_kv enable row level security;

drop policy if exists "controle_embarque_trens_select" on public.app_kv;
drop policy if exists "controle_embarque_trens_insert" on public.app_kv;
drop policy if exists "controle_embarque_trens_update" on public.app_kv;
drop policy if exists "controle_embarque_trens_delete" on public.app_kv;

create policy "controle_embarque_trens_select"
on public.app_kv for select
using (app = 'controle_embarque_trens');

create policy "controle_embarque_trens_insert"
on public.app_kv for insert
with check (app = 'controle_embarque_trens');

create policy "controle_embarque_trens_update"
on public.app_kv for update
using (app = 'controle_embarque_trens')
with check (app = 'controle_embarque_trens');

create policy "controle_embarque_trens_delete"
on public.app_kv for delete
using (app = 'controle_embarque_trens');
