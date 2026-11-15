import { DatabaseSync } from "node:sqlite";

/** Unico punto in cui si apre SQLite: cambiare motore = cambiare questo file. */
export type Db = DatabaseSync;

export function openDatabase(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}
