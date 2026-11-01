import fs from "node:fs";
import path from "node:path";
import { createDatabase, databasePath, migrate } from "./migrate";
import { seedDatabase } from "./seed";

/**
 * Rebuilds the local sandbox database.
 *
 * The current file (and its WAL companions) is copied to a timestamped backup
 * first, so an accidental reset never destroys the only copy of local data.
 */
function main(): void {
  const target = databasePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });

  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backup = path.join(path.dirname(target), `atlas.backup-${stamp}.db`);
    fs.copyFileSync(target, backup);
    for (const suffix of ["-wal", "-shm"]) {
      const companion = `${target}${suffix}`;
      if (fs.existsSync(companion)) fs.copyFileSync(companion, `${backup}${suffix}`);
    }
    console.log(`Backed up existing database to ${backup}`);
  }

  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${target}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  const db = createDatabase(target);
  try {
    migrate(db);
    seedDatabase(db);
    const counts = db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM accounts) AS accounts,
                (SELECT COUNT(*) FROM journal_entries) AS journals`,
      )
      .get() as { users: number; accounts: number; journals: number };
    console.log(
      `Reset ${target}: ${counts.users} users, ${counts.accounts} accounts, ${counts.journals} journals.`,
    );
  } finally {
    db.close();
  }
}

main();
