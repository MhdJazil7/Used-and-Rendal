import { dbQuery, dbTransaction } from '../db';

export interface RetentionRunResult {
  recordsEvaluated: number;
  anonymizedCount: number;
  skippedActiveDisputes: number;
  skippedLegalHolds: number;
}

export class RetentionEngine {
  /**
   * Evaluates records past retention_until and safely purges or anonymizes them,
   * strictly adhering to active disputes and legal holds.
   */
  static async runRetentionSweep(): Promise<RetentionRunResult> {
    return await dbTransaction(async ({ query }) => {
      // 1. Fetch expired verification records
      const candidates = await query(
        `SELECT vr.id, vr.user_id, vr.legal_hold, vr.minimal_metadata
         FROM verification_records vr
         WHERE vr.retention_until IS NOT NULL 
           AND vr.retention_until < CURRENT_TIMESTAMP
           AND vr.minimal_metadata->>'anonymized' IS NULL
         FOR UPDATE`
      );

      let anonymizedCount = 0;
      let skippedLegalHolds = 0;
      let skippedActiveDisputes = 0;

      for (const rec of candidates.rows) {
        // Check 1: Explicit legal hold on user or verification record
        if (rec.legal_hold) {
          skippedLegalHolds++;
          continue;
        }

        const holdCheck = await query(
          `SELECT id FROM legal_holds WHERE user_id = $1 AND released_at IS NULL`,
          [rec.user_id]
        );
        if (holdCheck.rows.length > 0) {
          skippedLegalHolds++;
          continue;
        }

        // Check 2: Active disputes on any booking involving this user
        const disputeCheck = await query(
          `SELECT d.id FROM disputes d
           JOIN bookings b ON b.id = d.booking_id
           WHERE (b.customer_id = $1 OR b.owner_id = $1)
             AND d.status IN ('OPEN', 'IN_PROGRESS', 'WAITING_PARTIES')`,
          [rec.user_id]
        );
        if (disputeCheck.rows.length > 0) {
          skippedActiveDisputes++;
          continue;
        }

        // Safe to purge document storage paths and anonymize
        await query(
          `DELETE FROM verification_documents WHERE verification_record_id = $1`,
          [rec.id]
        );

        // Anonymize metadata while retaining compliance timestamp
        await query(
          `UPDATE verification_records SET
             minimal_metadata = '{"anonymized": true, "status": "PURGED_RETENTION_EXPIRED"}'::jsonb,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [rec.id]
        );

        anonymizedCount++;
      }

      return {
        recordsEvaluated: candidates.rows.length,
        anonymizedCount,
        skippedActiveDisputes,
        skippedLegalHolds,
      };
    });
  }
}
