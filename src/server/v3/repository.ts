import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
export const dataRoot =
  process.env.LIVEPREVENT_DATA_DIR ?? path.join(process.cwd(), "mockdata");
let connection: DatabaseSync;
export function database() {
  if (!connection) {
    mkdirSync(dataRoot, { recursive: true });
    connection = new DatabaseSync(path.join(dataRoot, "assessments.sqlite"));
    connection.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS records (kind TEXT,id TEXT,payload TEXT NOT NULL,PRIMARY KEY(kind,id));",
    );
  }
  return connection;
}
export function put<T>(kind: string, id: string, value: T) {
  database()
    .prepare(
      "INSERT INTO records(kind,id,payload) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET payload=excluded.payload",
    )
    .run(kind, id, JSON.stringify(value));
}
export function get<T>(kind: string, id: string): T | null {
  const r = database()
    .prepare("SELECT payload FROM records WHERE kind=? AND id=?")
    .get(kind, id) as { payload: string } | undefined;
  return r ? JSON.parse(r.payload) : null;
}
export function all<T>(kind: string): T[] {
  return (
    database()
      .prepare("SELECT payload FROM records WHERE kind=? ORDER BY rowid DESC")
      .all(kind) as { payload: string }[]
  ).map((r) => JSON.parse(r.payload));
}
export function remove(kind: string, id: string) {
  database().prepare("DELETE FROM records WHERE kind=? AND id=?").run(kind, id);
}
