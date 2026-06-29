-- Gmail Connections Table
-- Stores OAuth tokens for Gmail API access per user

CREATE TABLE IF NOT EXISTS gmail_connections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  expiry_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint per user (one Gmail connection per user)
CREATE UNIQUE INDEX IF NOT EXISTS gmail_connections_user_id_idx ON gmail_connections(user_id);

-- RLS: Users can only manage their own connection
ALTER TABLE gmail_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own Gmail connection" ON gmail_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own Gmail connection" ON gmail_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Gmail connection" ON gmail_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Gmail connection" ON gmail_connections
  FOR DELETE USING (auth.uid() = user_id);