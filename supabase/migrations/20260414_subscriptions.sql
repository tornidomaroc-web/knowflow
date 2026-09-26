CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  paddle_subscription_id TEXT UNIQUE,
  paddle_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'free',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
