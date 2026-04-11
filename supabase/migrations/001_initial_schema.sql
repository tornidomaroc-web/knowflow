-- Profiles
create table profiles (
  id uuid references auth.users primary key,
  full_name text,
  email text unique not null,
  plan text default 'free',
  created_at timestamptz default now()
);

alter table profiles enable row level security;
create policy "Users can manage own profile" on profiles for all using (auth.uid() = id);

-- Trigger for profile creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Knowledge Bases
create table knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  description text,
  language text default 'ar',
  created_at timestamptz default now()
);

alter table knowledge_bases enable row level security;
create policy "Users can manage own KBs" on knowledge_bases for all using (auth.uid() = user_id);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  kb_id uuid references knowledge_bases(id) on delete cascade not null,
  filename text not null,
  file_type text,
  status text default 'pending',
  markdown_content text,
  chunk_count int default 0,
  created_at timestamptz default now()
);

alter table documents enable row level security;
create policy "Users can manage own documents" on documents for all using (
  auth.uid() = (select user_id from knowledge_bases where id = kb_id)
);

-- Conversations
create table conversations (
  id uuid primary key default gen_random_uuid(),
  kb_id uuid references knowledge_bases(id) on delete cascade not null,
  user_id uuid references profiles(id) not null,
  platform text default 'web',
  created_at timestamptz default now()
);

alter table conversations enable row level security;
create policy "Users can manage own conversations" on conversations for all using (auth.uid() = user_id);

-- Messages
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  role text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table messages enable row level security;
create policy "Users can manage own messages" on messages for all using (
  auth.uid() = (select user_id from conversations where id = conversation_id)
);
