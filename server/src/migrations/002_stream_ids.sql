-- Gli id che il player vede devono essere NUMERICI (stream_id, series_id).
-- Gli id interni restano UUID; qui aggiungiamo il numero che va in onda.
-- Vengono assegnati dall'ingest (fase 3), per linea.

ALTER TABLE streams  ADD COLUMN stream_id INTEGER;
ALTER TABLE movies   ADD COLUMN stream_id INTEGER;
ALTER TABLE episodes ADD COLUMN stream_id INTEGER;
ALTER TABLE series   ADD COLUMN series_id INTEGER;

CREATE UNIQUE INDEX idx_streams_num  ON streams(line_id, stream_id);
CREATE UNIQUE INDEX idx_movies_num   ON movies(line_id, stream_id);
CREATE UNIQUE INDEX idx_series_num   ON series(line_id, series_id);
CREATE UNIQUE INDEX idx_episodes_num ON episodes(series_id, stream_id);
