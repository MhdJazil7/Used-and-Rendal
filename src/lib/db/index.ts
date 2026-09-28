import { PGlite } from '@electric-sql/pglite';
import path from 'path';
import fs from 'fs';

// Global singleton to prevent multiple DB instances in Next.js hot reload
declare global {
  var __pgliteInstance: PGlite | undefined;
}

const DATA_DIR = path.join(process.cwd(), '.pgdata');

export async function getDbInstance(): Promise<PGlite> {
  if (global.__pgliteInstance) {
    return global.__pgliteInstance;
  }

  let db: PGlite;
  // In test runs or when memory is requested, use in-memory Postgres to guarantee clean concurrency and zero disk locks
  if (process.env.NODE_ENV === 'test' || process.env.DATABASE_USE_MEMORY === 'true') {
    db = new PGlite();
  } else {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      db = new PGlite(DATA_DIR);
      await db.waitReady;
    } catch {
      db = new PGlite();
    }
  }

  await db.waitReady;
  global.__pgliteInstance = db;

  // Auto-apply migrations if schema is fresh
  try {
    const tableCheck = await db.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'vehicles'"
    );
    if (tableCheck.rows.length === 0) {
      const { runMigrations } = await import('./migrate');
      await runMigrations();
    }
  } catch (err) {
    console.error('Failed to auto-run migrations on DB init:', err);
  }

  return db;
}

export async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<{ rows: T[]; rowCount: number }> {
  const db = await getDbInstance();
  try {
    const res = await db.query(sql, params);
    return {
      rows: (res.rows as T[]) || [],
      rowCount: res.rows?.length || 0,
    };
  } catch (error) {
    console.error('Database query error:', { sql: sql.slice(0, 150), params, error });
    throw error;
  }
}

import { AsyncLocalStorage } from 'async_hooks';

const txStorage = new AsyncLocalStorage<{ query: typeof dbQuery }>();
let txQueue: Promise<any> = Promise.resolve();

export async function dbTransaction<T>(fn: (client: { query: typeof dbQuery }) => Promise<T>): Promise<T> {
  const activeTx = txStorage.getStore();
  if (activeTx) {
    // Already executing inside an active transaction: reuse active client
    return await fn(activeTx);
  }

  return new Promise<T>((resolve, reject) => {
    txQueue = txQueue.then(async () => {
      const db = await getDbInstance();
      await db.query('BEGIN');
      const client = {
        query: async <R = any>(sql: string, params: any[] = []): Promise<{ rows: R[]; rowCount: number }> => {
          const res = await db.query(sql, params);
          return {
            rows: (res.rows as R[]) || [],
            rowCount: res.rows?.length || 0,
          };
        },
      };

      try {
        const result = await txStorage.run(client, () => fn(client));
        await db.query('COMMIT');
        resolve(result);
      } catch (error) {
        try {
          await db.query('ROLLBACK');
        } catch {
          // ignore rollback failure if transaction already aborted
        }
        reject(error);
      }
    }).catch(() => {
      // Prevents unhandled rejections on the queue chain itself
    });
  });
}
