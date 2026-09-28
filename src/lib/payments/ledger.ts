import { dbQuery } from '../db';
import crypto from 'crypto';

export type LedgerEntryType =
  | 'RENTAL_REVENUE'
  | 'SECURITY_DEPOSIT_RECEIPT'
  | 'PLATFORM_COMMISSION'
  | 'TAX_PAYABLE'
  | 'DEPOSIT_REFUND'
  | 'DAMAGE_DEDUCTION'
  | 'OWNER_PAYOUT'
  | 'OWNER_PAYOUT_REVERSAL'
  | 'DISPUTE_ADJUSTMENT';

export type LedgerDirection = 'CREDIT' | 'DEBIT';

export interface CreateLedgerEntryInput {
  bookingId?: string;
  entryType: LedgerEntryType;
  direction: LedgerDirection;
  amount: number;
  currency?: string;
  accountReference: 'CUSTOMER' | 'OWNER' | 'PLATFORM' | 'DEPOSIT_ESCROW';
  providerReference?: string;
  description: string;
}

/**
 * Append-only immutable ledger recorder.
 * Completed entries are never updated or deleted.
 */
export async function recordLedgerEntry(input: CreateLedgerEntryInput, queryFn = dbQuery) {
  if (input.amount <= 0) {
    throw new Error('Ledger entry amount must be strictly greater than 0');
  }

  const id = `led_${crypto.randomUUID()}`;

  await queryFn(
    `INSERT INTO ledger_entries (
       id, booking_id, entry_type, direction, amount, currency, account_reference, provider_reference, description
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      input.bookingId || null,
      input.entryType,
      input.direction,
      input.amount,
      input.currency || 'INR',
      input.accountReference,
      input.providerReference || null,
      input.description,
    ]
  );

  return { id, ...input };
}
