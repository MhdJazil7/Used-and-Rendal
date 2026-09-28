'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, ArrowLeft, FileText, AlertTriangle } from 'lucide-react';

const POLICY_CONTENT: Record<string, { title: string; version: string; updated: string; content: string[] }> = {
  terms: {
    title: 'Terms of Service',
    version: '2026.1-Kerala',
    updated: '2026-09-01',
    content: [
      '1. Platform Role: KeralaDrive provides an intermediary marketplace connecting verified vehicle owners and licensed drivers. The platform maintains server-authoritative booking state and facilitates secure payments.',
      '2. User Verification: All customers must complete phone OTP authentication and government ID / Driving Licence verification before submitting a vehicle rental booking request.',
      '3. Manual Owner Decision: Bookings are never automatically confirmed upon date selection. The vehicle owner retains absolute discretion to manually accept or reject each rental request.',
      '4. Payment Hold Window: Upon owner acceptance, an exclusive 15-minute booking hold is created. The customer must complete the transaction within this window, after which the slot is automatically released.',
    ],
  },
  cancellation: {
    title: 'Cancellation & Refund Policy',
    version: '2026.1-Kerala',
    updated: '2026-09-01',
    content: [
      '1. Cancellation Before Acceptance: Free cancellation at any time with 0 charges while a booking is in REQUESTED status.',
      '2. Customer Cancellation > 24 Hours Prior to Pickup: Full refund of rental amount and 100% of security deposit. Platform service fee may be credited as platform credit.',
      '3. Customer Cancellation < 24 Hours Prior to Pickup: 50% rental fee retained by the host to compensate for blocked availability; 100% of security deposit refunded.',
      '4. Owner Cancellation: 100% full refund to customer including all fees and deposit.',
    ],
  },
  deposits: {
    title: 'Security Deposit & Damage Settlement Policy',
    version: '2026.1-Kerala',
    updated: '2026-09-01',
    content: [
      '1. Mandatory Protection: Security deposits are held in designated settlement escrow and never commingled with platform operational revenue.',
      '2. Inspection Standard: Condition is determined strictly by comparing the digital pickup inspection and digital return inspection (including odometer and fuel readings).',
      '3. No Unilateral Withholding: An owner cannot unilaterally claim a deposit. Any deduction requires photographic evidence and structured damage classification.',
      '4. Dispute Freezing: If a customer disputes a damage deduction, the security deposit is immediately frozen by the state machine until staff adjudication is finalized.',
    ],
  },
  'kerala-regulations': {
    title: 'Kerala Transport & Legal Vehicle Eligibility Notice',
    version: '2026.1-Kerala',
    updated: '2026-09-01',
    content: [
      '1. Motor Vehicles Act 1988 Compliance: Self-drive vehicle rentals operate under the Rent-a-Cab Scheme 1989 and relevant Kerala Motor Vehicles Rules.',
      '2. Commercial Permits: Vehicles listed for self-drive commercial rental must possess valid commercial registration (yellow on black or designated rental plates), comprehensive commercial insurance, and valid fitness / PUC certificates.',
      '3. Disclaimer on Private Vehicles: Private registered vehicles (white plates) cannot legally be rented for commercial self-drive without appropriate statutory permits. The platform routes all listings through manual compliance verification.',
      '4. Speed & Highway Safety: Renters must comply with Kerala State Transport Department speed regulations (90 km/h on national/state highways; 50 km/h in municipal limits).',
    ],
  },
};

export default function PolicyPage() {
  const { slug } = useParams();
  const policyKey = (slug as string) || 'terms';
  const policy = POLICY_CONTENT[policyKey] || POLICY_CONTENT.terms;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700">
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to Home</span>
      </Link>

      <div className="border-b border-gray-200 pb-4">
        <span className="text-[11px] font-mono text-gray-400 uppercase">Version: {policy.version} • Effective: {policy.updated}</span>
        <h1 className="text-3xl font-black text-gray-900 mt-1">{policy.title}</h1>
      </div>

      <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4 text-xs sm:text-sm text-gray-700 leading-relaxed">
        {policy.content.map((p, i) => (
          <p key={i} className="p-3 rounded-xl bg-gray-50/50 border border-gray-100">
            {p}
          </p>
        ))}
      </div>

      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          This document represents the platform operational policy. Final legal interpretation of Motor Vehicles Act and transport compliance requires qualified legal review.
        </p>
      </div>
    </div>
  );
}
