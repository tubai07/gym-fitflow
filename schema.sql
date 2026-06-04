-- Supabase Database Schema for FitFlow

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  phone text,
  updated_at timestamp with time zone default now()
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles Policies
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create user_exercises table
create table public.user_exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null default auth.uid(),
  workout_id text not null,
  name text not null,
  video text,
  reps text,
  sets integer,
  sort_order integer not null,
  is_done boolean default false not null,
  updated_at timestamp with time zone default now()
);

-- Enable RLS on user_exercises
alter table public.user_exercises enable row level security;

-- User Exercises Policies
create policy "Users can view their own exercises"
  on public.user_exercises for select
  using (auth.uid() = user_id);

create policy "Users can insert their own exercises"
  on public.user_exercises for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own exercises"
  on public.user_exercises for update
  using (auth.uid() = user_id);

create policy "Users can delete their own exercises"
  on public.user_exercises for delete
  using (auth.uid() = user_id);

-- Trigger to automatically create a profile entry for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, phone, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    coalesce(new.raw_user_meta_data->>'phone', ''),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Realtime replication for the user_exercises table
alter publication supabase_realtime add table public.user_exercises;
