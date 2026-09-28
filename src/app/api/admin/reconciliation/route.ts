import { NextRequest } from 'next/server';
import { AuthService } from '@/lib/auth/session';
import { dbQuery } from '@/lib/db';
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || req.cookies.get('kvr_session')?.value;
    const session = AuthService.verifySessionToken(authHeader);

    if (!session) {
      return apiUnauthorized('Authentication required');
    }

    if (!session.roles.includes('ADMIN') && !session.roles.includes('SUPER_ADMIN')) {
      return apiForbidden('Administrative privileges required');
    }

    // Compare payment_orders with payment_transactions and booking_price_snapshots
    const res = await dbQuery(`
      SELECT b.id as booking_id, b.booking_reference, b.status as booking_status,
             s.total_payable_now as snapshot_expected_total,
             COALESCE(o.amount, 0) as order_amount,
             COALESCE(t.amount, 0) as transaction_paid_amount,
             COALESCE(d.amount_held, 0) as deposit_held,
             COALESCE(d.amount_refunded, 0) as deposit_refunded,
             CASE 
               WHEN b.status = 'CONFIRMED' AND (t.amount IS NULL OR t.amount != s.total_payable_now) THEN 'MISMATCH'
               ELSE 'MATCHED'
             END as reconciliation_flag
      FROM bookings b
      LEFT JOIN booking_price_snapshots s ON s.booking_id = b.id
      LEFT JOIN payment_orders o ON o.booking_id = b.id AND o.status = 'PAID'
      LEFT JOIN payment_transactions t ON t.order_id = o.id AND t.status = 'SUCCESS'
      LEFT JOIN deposits d ON d.booking_id = b.id
      ORDER BY b.created_at DESC
      LIMIT 100
    `);

    // Fetch ledger totals
    const ledgerTotals = await dbQuery(`
      SELECT account_reference, direction, SUM(amount) as total_amount
      FROM ledger_entries
      GROUP BY account_reference, direction
    `);

    return apiSuccess({
      items: res.rows,
      ledgerSummary: ledgerTotals.rows,
      mismatchCount: res.rows.filter((r) => r.reconciliation_flag === 'MISMATCH').length,
    });
  } catch (err: any) {
    return apiError(err.message, 'RECONCILIATION_ERROR', 500);
  }
}
