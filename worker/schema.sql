-- Pickup Football D1 schema
-- 应用方式：npm run db:schema:local / db:schema:remote

CREATE TABLE IF NOT EXISTS matches (
  id                 TEXT    PRIMARY KEY,        -- crypto.randomUUID()
  date               TEXT    NOT NULL,           -- YYYY-MM-DD（墙上时间，所选时区）
  time               TEXT    NOT NULL,           -- HH:MM
  timezone           TEXT    NOT NULL DEFAULT 'Asia/Seoul',
  start_utc          INTEGER NOT NULL,           -- 绝对 UTC 毫秒，所有时间比较用它
  venue              TEXT    NOT NULL,
  venue_lat          REAL,                       -- 选填：选中地点纬度（OSM）；纯文字场地为 NULL
  venue_lon          REAL,                       -- 选填：选中地点经度（OSM）；纯文字场地为 NULL
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
  paid        INTEGER NOT NULL DEFAULT 0,        -- 已付活动费（本人开关，默认 0）
  created_at  INTEGER NOT NULL,
  UNIQUE(match_id, pin_lookup)                   -- 同场 PIN 判重
);

-- 限流表：bucket = "类型:ip[:matchId]"，滑动窗口计数
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket       TEXT    PRIMARY KEY,
  count        INTEGER NOT NULL,
  window_start INTEGER NOT NULL                  -- UTC 毫秒
);

CREATE INDEX IF NOT EXISTS idx_reg_match     ON registrations(match_id, position);
CREATE INDEX IF NOT EXISTS idx_matches_start ON matches(start_utc);
