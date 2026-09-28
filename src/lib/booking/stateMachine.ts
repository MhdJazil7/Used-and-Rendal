import { BookingStatus, UserRole } from '../types';
import { dbQuery, dbTransaction } from '../db';
import crypto from 'crypto';

export interface TransitionContext {
  bookingId: string;
  targetStatus: BookingStatus;
  actorId: string;
  actorRole: UserRole | 'SYSTEM';
  reason?: string;
  paymentDeadline?: Date;
}

// Complete Legal Transition Graph
const LEGAL_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  DRAFT: ['REQUESTED', 'CUSTOMER_CANCELLED'],
  REQUESTED: ['OWNER_ACCEPTED', 'OWNER_REJECTED', 'CUSTOMER_CANCELLED', 'EXPIRED', 'ADMIN_SUSPENDED'],
  OWNER_ACCEPTED: ['PAYMENT_PENDING', 'CUSTOMER_CANCELLED', 'OWNER_CANCELLED', 'EXPIRED', 'ADMIN_SUSPENDED'],
  PAYMENT_PENDING: ['CONFIRMED', 'PAYMENT_FAILED', 'CUSTOMER_CANCELLED', 'EXPIRED', 'ADMIN_SUSPENDED'],
  PAYMENT_FAILED: ['PAYMENT_PENDING', 'EXPIRED', 'CUSTOMER_CANCELLED', 'ADMIN_SUSPENDED'],
  CONFIRMED: ['PICKUP_PENDING', 'ACTIVE_RENTAL', 'CUSTOMER_CANCELLED', 'OWNER_CANCELLED', 'DISPUTED', 'ADMIN_SUSPENDED'],
  PICKUP_PENDING: ['ACTIVE_RENTAL', 'CUSTOMER_CANCELLED', 'OWNER_CANCELLED', 'DISPUTED', 'ADMIN_SUSPENDED'],
  ACTIVE_RENTAL: ['RETURN_PENDING', 'RETURNED', 'DISPUTED', 'ADMIN_SUSPENDED'],
  RETURN_PENDING: ['RETURNED', 'DISPUTED', 'ADMIN_SUSPENDED'],
  RETURNED: ['INSPECTION_PENDING', 'DEPOSIT_PENDING', 'DISPUTED', 'ADMIN_SUSPENDED'],
  INSPECTION_PENDING: ['DEPOSIT_PENDING', 'DISPUTED', 'ADMIN_SUSPENDED'],
  DEPOSIT_PENDING: ['DEPOSIT_REFUNDED', 'DEPOSIT_PARTIAL_REFUND', 'DISPUTED', 'COMPLETED', 'ADMIN_SUSPENDED'],
  DEPOSIT_PARTIAL_REFUND: ['COMPLETED', 'DISPUTED', 'ADMIN_SUSPENDED'],
  DEPOSIT_REFUNDED: ['COMPLETED', 'ADMIN_SUSPENDED'],
  COMPLETED: [], // Terminal
  CUSTOMER_CANCELLED: [], // Terminal
  OWNER_REJECTED: [], // Terminal
  OWNER_CANCELLED: [], // Terminal
  EXPIRED: [], // Terminal
  DISPUTED: ['DEPOSIT_PENDING', 'DEPOSIT_PARTIAL_REFUND', 'DEPOSIT_REFUNDED', 'COMPLETED', 'ADMIN_SUSPENDED'],
  ADMIN_SUSPENDED: ['REQUESTED', 'CONFIRMED', 'ACTIVE_RENTAL', 'CUSTOMER_CANCELLED', 'OWNER_CANCELLED', 'COMPLETED']
};

export function isTransitionLegal(from: BookingStatus, to: BookingStatus): boolean {
  const allowed = LEGAL_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

export async function transitionBookingStatus(ctx: TransitionContext): Promise<{ success: boolean; fromStatus: BookingStatus; toStatus: BookingStatus }> {
  return await dbTransaction(async ({ query }) => {
    // 1. Fetch current booking under row lock
    const bookingRes = await query(
      'SELECT id, status, customer_id, owner_id FROM bookings WHERE id = $1 FOR UPDATE',
      [ctx.bookingId]
    );

    if (bookingRes.rows.length === 0) {
      throw new Error(`Booking not found: ${ctx.bookingId}`);
    }

    const currentBooking = bookingRes.rows[0];
    const fromStatus = currentBooking.status as BookingStatus;
    const toStatus = ctx.targetStatus;

    // 2. Validate legality of transition
    if (!isTransitionLegal(fromStatus, toStatus)) {
      throw new Error(`Illegal booking status transition: cannot transition from '${fromStatus}' to '${toStatus}'`);
    }

    // 3. Validate actor authority for specific sensitive transitions
    if (ctx.actorRole !== 'SYSTEM' && ctx.actorRole !== 'ADMIN' && ctx.actorRole !== 'SUPER_ADMIN') {
      if (toStatus === 'OWNER_ACCEPTED' || toStatus === 'OWNER_REJECTED') {
        if (currentBooking.owner_id !== ctx.actorId) {
          throw new Error('Unauthorized: only the vehicle owner can accept or reject this booking request');
        }
      } else if (toStatus === 'CUSTOMER_CANCELLED') {
        if (currentBooking.customer_id !== ctx.actorId) {
          throw new Error('Unauthorized: only the customer who booked can cancel this booking');
        }
      }
    }

    // 4. Update booking record
    let updateSql = 'UPDATE bookings SET status = $1, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [toStatus];
    let paramIndex = 2;

    if (toStatus === 'OWNER_REJECTED' && ctx.reason) {
      updateSql += `, rejection_reason = $${paramIndex++}`;
      params.push(ctx.reason);
    } else if (toStatus === 'CUSTOMER_CANCELLED' || toStatus === 'OWNER_CANCELLED') {
      updateSql += `, cancellation_reason = $${paramIndex++}`;
      params.push(ctx.reason || 'User cancelled');
    }

    if (ctx.paymentDeadline) {
      updateSql += `, payment_deadline = $${paramIndex++}`;
      params.push(ctx.paymentDeadline.toISOString());
    }

    updateSql += ` WHERE id = $${paramIndex}`;
    params.push(ctx.bookingId);

    await query(updateSql, params);

    // 5. Append immutable audit history record
    const historyId = `bsh_${crypto.randomUUID()}`;
    const actorProfileId = ctx.actorId === 'SYSTEM' ? null : ctx.actorId;
    await query(
      `INSERT INTO booking_status_history (id, booking_id, from_status, to_status, actor_id, actor_role, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [historyId, ctx.bookingId, fromStatus, toStatus, actorProfileId, ctx.actorRole, ctx.reason || null]
    );

    return {
      success: true,
      fromStatus,
      toStatus,
    };
  });
}
