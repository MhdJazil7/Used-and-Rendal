'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, MessageSquare, AlertTriangle, FileText } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 text-gray-600 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-gray-900 text-sm mb-3">KeralaDrive Marketplace</h3>
            <p className="text-gray-500 leading-relaxed mb-3">
              Kerala-first mobile-friendly vehicle rental marketplace connecting verified owners with responsible travelers. Operating across all 14 districts of Kerala.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-xs">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>WhatsApp Verified Channel</span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Rental Resources</h4>
            <ul className="space-y-2">
              <li><Link href="/rent" className="hover:text-emerald-600">Search Vehicles</Link></li>
              <li><Link href="/owner" className="hover:text-emerald-600">Host / List Your Vehicle</Link></li>
              <li><Link href="/policies/cancellation" className="hover:text-emerald-600">Cancellation Policy</Link></li>
              <li><Link href="/policies/deposits" className="hover:text-emerald-600">Security Deposit Rules</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Legal & Governance</h4>
            <ul className="space-y-2">
              <li><Link href="/policies/terms" className="hover:text-emerald-600">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-emerald-600">Privacy Notice & Consents</Link></li>
              <li><Link href="/policies/kerala-regulations" className="hover:text-emerald-600">Kerala Transport Regulatory Info</Link></li>
              <li><Link href="/admin" className="hover:text-purple-600">Operations & Audit Portal</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Customer Support</h4>
            <p className="text-gray-500 mb-2">Dedicated Kerala helpline & WhatsApp support:</p>
            <p className="font-mono text-emerald-700 font-bold mb-3">+91 98460 00000</p>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] leading-tight flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                Rental eligibility adheres to Motor Vehicles Act & Kerala Rent-a-Cab guidelines. Commercial permits and eligibility are verified per vehicle.
              </span>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4 text-gray-400 text-[11px]">
          <p>© 2026 KeralaDrive Technologies. Built for Kerala, ready for India.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Server-Authoritative Concurrency
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              Double-Entry Ledger
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
