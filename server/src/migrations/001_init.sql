-- Schema v1 di StreamHub J.A.R.V.I.S.
-- Regola: ogni riga di catalogo ha line_id. Gli id sono testuali (UUID).

CREATE TABLE users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'user',      -- user | admin
  plan            TEXT NOT NULL DEFAULT 'trial',     -- trial | base | pro | lifetime
  plan_expires_at TEXT,                              -- NULL = senza scadenza
  created_at      TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE TABLE lines (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  xtream_username TEXT NOT NULL UNIQUE,
  xtream_password TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',    -- active | expired | disabled
  max_connections INTEGER NOT NULL DEFAULT 1,
  expires_at      TEXT,
  created_at      TEXT NOT NULL
);

CREATE TABLE sources (
  id         TEXT PRIMARY KEY,
  line_id    TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,                          -- m3u | xtream | local
  url        TEXT NOT NULL,
  username   TEXT,
  password   TEXT,
  last_sync  TEXT,
  sync_error TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE categories (
  id      TEXT PRIMARY KEY,
  line_id TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  type    TEXT NOT NULL,                             -- live | vod | series
  name    TEXT NOT NULL,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE streams (
  id          TEXT PRIMARY KEY,
  line_id     TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  category_id TEXT,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT,
  epg_id      TEXT
);

CREATE TABLE movies (
  id          TEXT PRIMARY KEY,
  line_id     TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  category_id TEXT,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  icon        TEXT,
  plot        TEXT,
  year        INTEGER,
  tmdb_id     INTEGER,
  rating      REAL,
  duration    INTEGER
);

CREATE TABLE series (
  id          TEXT PRIMARY KEY,
  line_id     TEXT NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
  category_id TEXT,
  name        TEXT NOT NULL,
  cover       TEXT,
  plot        TEXT,
  year        INTEGER,
  tmdb_id     INTEGER,
  rating      REAL
);

CREATE TABLE episodes (
  id          TEXT PRIMARY KEY,
  series_id   TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  season      INTEGER NOT NULL,
  num         INTEGER NOT NULL,
  name        TEXT NOT NULL,
  url         TEXT,
  icon        TEXT,
  plot        TEXT,
  duration    INTEGER
);

CREATE INDEX idx_lines_user      ON lines(user_id);
CREATE INDEX idx_lines_auth      ON lines(xtream_username);
CREATE INDEX idx_sessions_user   ON sessions(user_id);
CREATE INDEX idx_sources_line    ON sources(line_id);
CREATE INDEX idx_categories_line ON categories(line_id, type);
CREATE INDEX idx_streams_line    ON streams(line_id, category_id);
CREATE INDEX idx_movies_line     ON movies(line_id, category_id);
CREATE INDEX idx_series_line     ON series(line_id, category_id);
CREATE INDEX idx_episodes_serie  ON episodes(series_id, season, num);
