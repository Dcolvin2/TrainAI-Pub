create table if not exists user_maxes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  exercise_name   text not null,
  max_weight      int not null,
  updated_at      timestamptz default now(),
  unique(user_id, exercise_name)
);

alter table user_maxes enable row level security;

drop policy if exists "Users manage their maxes" on user_maxes;
create policy "Users manage their maxes"
  on user_maxes for all
  using (auth.uid() = user_id); 