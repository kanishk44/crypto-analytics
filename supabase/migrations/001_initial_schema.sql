-- Token Insights Cache Table
CREATE TABLE IF NOT EXISTS token_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id TEXT NOT NULL,
  vs_currency TEXT NOT NULL DEFAULT 'usd',
  history_days INTEGER NOT NULL DEFAULT 30,
  token_json JSONB NOT NULL,
  insight_json JSONB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_token_insights_lookup 
  ON token_insights (token_id, vs_currency, history_days, created_at DESC);

-- Wallet Daily PnL Cache Table
CREATE TABLE IF NOT EXISTS wallet_daily_pnls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  daily JSONB NOT NULL,
  summary JSONB NOT NULL,
  diagnostics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_lookup 
  ON wallet_daily_pnls (wallet, start_date, end_date, created_at DESC);

-- Enable Row Level Security (optional, for production)
ALTER TABLE token_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_daily_pnls ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for the service (using service role key bypasses RLS)
-- For anon key access, create policies:
CREATE POLICY "Allow anonymous read" ON token_insights FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON token_insights FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous read" ON wallet_daily_pnls FOR SELECT USING (true);
CREATE POLICY "Allow anonymous insert" ON wallet_daily_pnls FOR INSERT WITH CHECK (true);

