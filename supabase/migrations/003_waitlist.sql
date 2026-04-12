CREATE TABLE public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  plan text default 'pro',
  created_at timestamptz default now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist" ON public.waitlist
  FOR INSERT WITH CHECK (true);
