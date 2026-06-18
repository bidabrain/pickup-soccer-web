-- Pickup Football D1 schema
-- 应用方式：npm run db:schema:local / db:schema:remote

CREATE TABLE IF NOT EXISTS matches (
  id                 TEXT    PRIMARY KEY,        -- crypto.randomUUID()
  date               TEXT    NOT NULL,           -- YYYY-MM-DD（墙上时间，所选时区）
  time               TEXT    NOT NULL,           -- HH:MM
  timezone           TEXT    NOT NULL DEFAULT 'Asia/Seoul',
  start_utc          INTEGER NOT NULL,           -- 绝对 UTC 毫秒，所有时间比较用它
  venue              TEXT    NOT NULL,
  fee                INTEGER NOT NULL,           -- 每人费用（整数元）
  max_players        INTEGER NOT NULL,           -- 上场人数
  note               TEXT,                       -- 备注（可空）
  organizer_pin_hash TEXT    NOT NULL,           -- 管理 PIN（PBKDF2）
  match_secret       TEXT    NOT NULL,           -- HMAC 密钥（base64）
  captains_drawn     INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL            -- UTC 毫秒
);

CREATE TABLE IF NOT EXISTS registrations (
  id          TEXT    PRIMARY KEY,
  match_id    TEXT    NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  pin_hash    TEXT    NOT NULL,                  -- 个人 PIN（PBKDF2）
  pin_lookup  TEXT    NOT NULL,                  -- HMAC，用于同场判重
  position    INTEGER NOT NULL,                  -- 报名顺序 1..n
  is_captain  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL,
  UNIQUE(match_id, pin_lookup)                   -- 同场 PIN 判重
);

CREATE INDEX IF NOT EXISTS idx_reg_match     ON registrations(match_id, position);
CREATE INDEX IF NOT EXISTS idx_matches_start ON matches(start_utc);
