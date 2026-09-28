import { describe, it, expect, beforeAll } from 'vitest';
import { runMigrations } from '../src/lib/db/migrate';
import { RetentionEngine } from '../src/lib/retention/retentionWorker';
import { dbQuery } from '../src/lib/db';
import crypto from 'crypto';

describe('Data Retention & Legal Hold Engine', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('safely purges expired verification records while respecting legal holds', async () => {
    const expiredUserId = `usr_test_ret_${Date.now()}`;
    const heldUserId = `usr_test_held_${Date.now()}`;

    // Create user profiles
    await dbQuery(
      `INSERT INTO profiles (id, phone, full_name, address_district) 
       VALUES ($1, $2, 'Test Ret User', 'Ernakulam'), ($3, $4, 'Test Held User', 'Ernakulam')`,
      [expiredUserId, `+919999900010`, heldUserId, `+919999900011`]
    );

    // Create expired verification record without legal hold
    const rec1Id = `vr_test_exp_${Date.now()}`;
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await dbQuery(
      `INSERT INTO verification_records (id, user_id, verification_type, status, retention_until, legal_hold)
       VALUES ($1, $2, 'IDENTITY', 'VERIFIED', $3, FALSE)`,
      [rec1Id, expiredUserId, pastDate]
    );

    // Create expired verification record WITH legal hold
    const rec2Id = `vr_test_held_${Date.now()}`;
    await dbQuery(
      `INSERT INTO verification_records (id, user_id, verification_type, status, retention_until, legal_hold)
       VALUES ($1, $2, 'IDENTITY', 'VERIFIED', $3, TRUE)`,
      [rec2Id, heldUserId, pastDate]
    );

    // Run Retention Engine
    const result = await RetentionEngine.runRetentionSweep();

    expect(result.recordsEvaluated).toBeGreaterThan(0);
    expect(result.anonymizedCount).toBeGreaterThan(0);
    expect(result.skippedLegalHolds).toBeGreaterThan(0);

    // Verify rec1 was anonymized
    const check1 = await dbQuery(`SELECT minimal_metadata FROM verification_records WHERE id = $1`, [rec1Id]);
    expect(check1.rows[0].minimal_metadata?.anonymized).toBe(true);

    // Verify rec2 was PRESERVED due to legal hold
    const check2 = await dbQuery(`SELECT minimal_metadata FROM verification_records WHERE id = $1`, [rec2Id]);
    expect(check2.rows[0].minimal_metadata?.anonymized).toBeUndefined();
  });
});
