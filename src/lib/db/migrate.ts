import fs from 'fs';
import path from 'path';
import { getDbInstance } from './index';

export async function runMigrations() {
  const db = await getDbInstance();

  // Create migrations tracker table
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`[Migrations] Found ${files.length} migration files in ${migrationsDir}`);

  for (const file of files) {
    const res = await db.query('SELECT version FROM schema_migrations WHERE version = $1', [file]);
    if (res.rows.length > 0) {
      // Already applied
      continue;
    }

    console.log(`[Migrations] Applying ${file}...`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // Execute migration in transaction
    await db.query('BEGIN');
    try {
      // Some migrations might contain multiple statements
      await db.exec(sql);
      await db.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      await db.query('COMMIT');
      console.log(`[Migrations] Successfully applied ${file}`);
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`[Migrations] Failed to apply ${file}:`, err);
      throw err;
    }
  }

  console.log('[Migrations] All migrations completed successfully.');
}

// Allow standalone execution: npx tsx src/lib/db/migrate.ts or node
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
