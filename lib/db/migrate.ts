// Minimal, dependency-light migration runner.
//
// ADR-0002 keeps geometry and raster math out of TypeScript; the same
// reasoning extends here — migrations are plain, reviewable SQL files, not
// an ORM's generated DDL. This script only sequences and records which of
// them have run.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

// import.meta.dirname is left unset when tsx transpiles this to CJS for
// `pnpm db:migrate`; deriving it from import.meta.url works under both.
const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "migrations");

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const applied = new Set(
      (await client.query<{ filename: string }>("SELECT filename FROM schema_migrations")).rows.map(
        (row) => row.filename,
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`skip  ${file} (already applied)`);
        continue;
      }

      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      console.log(`apply ${file}`);

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    console.log("migrations up to date");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
