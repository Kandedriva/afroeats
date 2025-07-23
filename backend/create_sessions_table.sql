-- Create sessions table for connect-pg-simple
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL
)
WITH (OIDS=FALSE);

-- Add primary key and index
ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;

-- Create index on expire column for cleanup
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Verify table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'session';