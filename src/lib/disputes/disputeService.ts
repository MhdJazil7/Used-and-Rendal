import { dbQuery, dbTransaction } from '../db';
import { transitionBookingStatus } from '../booking/stateMachine';
import { PaymentService } from '../payments/paymentService';
import crypto from 'crypto';

export interface CreateDisputeInput {
  bookingId: string;
  initiatedBy: string;
  category: 'DAMAGE' | 'PAYMENT' | 'DEPOSIT' | 'REFUND' | 'CANCELLATION' | 'VEHICLE_CONDITION' | 'VEHICLE_NOT_AS_DESCRIBED' | 'PICKUP' | 'RETURN' | 'OTHER';
  description: string;
}

export interface ResolveDisputeInput {
  disputeId: string;
  staffId: string;
  resolutionNotes: string;
  depositAction: 'REFUND_FULL' | 'PARTIAL_TO_OWNER' | 'FULL_TO_OWNER' | 'NO_ACTION';
  ownerSettlementAmount?: number;
}

export class DisputeService {
  /**
   * Open a formal dispute. Freezes deposit release.
   */
  static async openDispute(input: CreateDisputeInput) {
    return await dbTransaction(async ({ query }) => {
      const bRes = await query(`SELECT id, status, customer_id, owner_id FROM bookings WHERE id = $1 FOR UPDATE`, [
        input.bookingId,
      ]);

      if (bRes.rows.length === 0) {
        throw new Error('Booking not found');
      }

      const booking = bRes.rows[0];

      if (booking.customer_id !== input.initiatedBy && booking.owner_id !== input.initiatedBy) {
        throw new Error('Unauthorized: only the booking customer or vehicle owner can raise a dispute');
      }

      const disputeId = `dsp_${crypto.randomUUID()}`;

      await query(
        `INSERT INTO disputes (id, booking_id, initiated_by, category, description, status)
         VALUES ($1, $2, $3, $4, $5, 'OPEN')`,
        [disputeId, input.bookingId, input.initiatedBy, input.category, input.description]
      );

      // Transition booking to DISPUTED to freeze deposit settlement
      await transitionBookingStatus({
        bookingId: input.bookingId,
        targetStatus: 'DISPUTED',
        actorId: input.initiatedBy,
        actorRole: booking.customer_id === input.initiatedBy ? 'CUSTOMER' : 'OWNER',
        reason: `Dispute opened: ${input.category} - ${input.description}`,
      });

      return {
        success: true,
        disputeId,
        status: 'OPEN',
      };
    });
  }

  /**
   * Staff/Admin resolves dispute and executes deposit settlement
   */
  static async resolveDispute(input: ResolveDisputeInput) {
    return await dbTransaction(async ({ query }) => {
      const dRes = await query(`SELECT * FROM disputes WHERE id = $1 FOR UPDATE`, [input.disputeId]);

      if (dRes.rows.length === 0) {
        throw new Error('Dispute not found');
      }

      const dispute = dRes.rows[0];

      if (dispute.status === 'RESOLVED' || dispute.status === 'CLOSED') {
        throw new Error('Dispute is already resolved');
      }

      // Update dispute record
      await query(
        `UPDATE disputes SET 
           status = 'RESOLVED',
           assigned_staff_id = $1,
           resolution_notes = $2,
           deposit_action = $3,
           resolved_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [input.staffId, input.resolutionNotes, input.depositAction, input.disputeId]
      );

      // Perform deposit settlement based on resolution action
      let deduction = 0;
      if (input.depositAction === 'FULL_TO_OWNER') {
        const dep = await query(`SELECT amount_held FROM deposits WHERE booking_id = $1`, [dispute.booking_id]);
        deduction = Number(dep.rows[0]?.amount_held || 0);
      } else if (input.depositAction === 'PARTIAL_TO_OWNER') {
        deduction = input.ownerSettlementAmount || 0;
      }

      // Execute deposit settlement via PaymentService
      await PaymentService.settleDeposit(
        dispute.booking_id,
        deduction,
        `Dispute resolved: ${input.depositAction}. ${input.resolutionNotes}`
      );

      return {
        success: true,
        disputeId: input.disputeId,
        status: 'RESOLVED',
        deductionApplied: deduction,
      };
    });
  }
}
