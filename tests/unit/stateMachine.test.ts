import { describe, it, expect } from 'vitest';
import { isTransitionLegal } from '../../src/lib/booking/stateMachine';

describe('Authoritative Booking State Machine', () => {
  it('permits valid customer request to owner acceptance', () => {
    expect(isTransitionLegal('REQUESTED', 'OWNER_ACCEPTED')).toBe(true);
    expect(isTransitionLegal('REQUESTED', 'OWNER_REJECTED')).toBe(true);
    expect(isTransitionLegal('REQUESTED', 'CUSTOMER_CANCELLED')).toBe(true);
  });

  it('strictly forbids bypassing owner acceptance to confirmed status', () => {
    // Non-negotiable business guardrail: Customer CANNOT directly confirm without owner acceptance
    expect(isTransitionLegal('REQUESTED', 'CONFIRMED')).toBe(false);
    expect(isTransitionLegal('DRAFT', 'CONFIRMED')).toBe(false);
  });

  it('strictly forbids paying directly from draft or completed states', () => {
    expect(isTransitionLegal('DRAFT', 'PAYMENT_PENDING')).toBe(false);
    expect(isTransitionLegal('COMPLETED', 'PAYMENT_PENDING')).toBe(false);
  });

  it('allows owner acceptance to open payment window', () => {
    expect(isTransitionLegal('OWNER_ACCEPTED', 'PAYMENT_PENDING')).toBe(true);
  });

  it('allows verified payment to transition to CONFIRMED', () => {
    expect(isTransitionLegal('PAYMENT_PENDING', 'CONFIRMED')).toBe(true);
  });

  it('allows confirmed rental to proceed through handover to active', () => {
    expect(isTransitionLegal('CONFIRMED', 'PICKUP_PENDING')).toBe(true);
    expect(isTransitionLegal('PICKUP_PENDING', 'ACTIVE_RENTAL')).toBe(true);
  });

  it('allows return and deposit settlement lifecycle', () => {
    expect(isTransitionLegal('ACTIVE_RENTAL', 'RETURNED')).toBe(true);
    expect(isTransitionLegal('RETURNED', 'INSPECTION_PENDING')).toBe(true);
    expect(isTransitionLegal('INSPECTION_PENDING', 'DEPOSIT_PENDING')).toBe(true);
    expect(isTransitionLegal('DEPOSIT_PENDING', 'DEPOSIT_REFUNDED')).toBe(true);
    expect(isTransitionLegal('DEPOSIT_REFUNDED', 'COMPLETED')).toBe(true);
  });

  it('freezes state in DISPUTED and permits resolution by authorized staff', () => {
    expect(isTransitionLegal('INSPECTION_PENDING', 'DISPUTED')).toBe(true);
    expect(isTransitionLegal('DEPOSIT_PENDING', 'DISPUTED')).toBe(true);
    // Cannot refund deposit directly while disputed
    expect(isTransitionLegal('DISPUTED', 'DEPOSIT_REFUNDED')).toBe(true);
    expect(isTransitionLegal('DISPUTED', 'COMPLETED')).toBe(true);
  });

  it('enforces terminal statuses as dead ends', () => {
    expect(isTransitionLegal('COMPLETED', 'REQUESTED')).toBe(false);
    expect(isTransitionLegal('CUSTOMER_CANCELLED', 'CONFIRMED')).toBe(false);
    expect(isTransitionLegal('OWNER_REJECTED', 'CONFIRMED')).toBe(false);
    expect(isTransitionLegal('EXPIRED', 'PAYMENT_PENDING')).toBe(false);
  });
});
