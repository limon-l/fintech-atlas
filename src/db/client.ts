import type Database from "better-sqlite3";
import { migrate, createDatabase, databasePath } from "./migrate";
import { seedDatabase } from "./seed";

const globalForDb = globalThis as unknown as { __atlasDb?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb.__atlasDb) {
    const db = createDatabase(databasePath());
    migrate(db);
    seedDatabase(db);
    globalForDb.__atlasDb = db;
  }
  return globalForDb.__atlasDb;
}

export function resetDb(): Database.Database {
  if (globalForDb.__atlasDb) {
    globalForDb.__atlasDb.close();
    globalForDb.__atlasDb = undefined;
  }
  return getDb();
}
