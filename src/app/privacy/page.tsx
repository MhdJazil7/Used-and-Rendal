'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import { ShieldCheck, Download, Trash2, AlertTriangle, CheckCircle2, Lock, FileText } from 'lucide-react';

export default function PrivacyCenterPage() {
  const { user, openAuthModal } = useApp();
  const [privacyData, setPrivacyData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetch('/api/privacy')
        .then((r) => r.json())
        .then((d) => {
          if (d.success) setPrivacyData(d.data);
        })
        .finally(() => setLoading(false));
    }
  }, [user]);

  const handlePrivacyAction = async (requestType: 'ACCESS_EXPORT' | 'DELETION') => {
    setRequestStatus(null);
    try {
      const res = await fetch('/api/privacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, reason: 'Initiated via Privacy Center' }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Request failed');
      }
      setRequestStatus({ type: 'success', text: data.data?.message || 'Request processed successfully.' });
    } catch (err: any) {
      setRequestStatus({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Privacy & Data Governance Center</h1>
        <p className="text-xs text-gray-500">
          Adheres to Digital Personal Data Protection (DPDP) principles and data minimization standards.
        </p>
      </div>

      {requestStatus && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            requestStatus.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {requestStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{requestStatus.text}</span>
        </div>
      )}

      {/* Core Privacy Principles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-gray-900">Data Minimization</h3>
          <p className="text-[11px] text-gray-500">
            We only collect identity details necessary to verify driving eligibility and process transactions.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-gray-900">Customer KYC Shield</h3>
          <p className="text-[11px] text-gray-500">
            Hosts never receive raw government ID scans or full ID numbers. Only verification badges are displayed.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-bold text-gray-900">Automated Retention</h3>
          <p className="text-[11px] text-gray-500">
            Documents past retention timelines are systematically purged, subject to statutory tax and dispute holds.
          </p>
        </div>
      </div>

      {/* User Actions */}
      {user ? (
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            Your Personal Data Rights
          </h2>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 border">
            <div>
              <h3 className="text-xs font-bold text-gray-900">Download Personal Data Archive</h3>
              <p className="text-[11px] text-gray-500">
                Obtain a complete machine-readable export of your bookings, payments, and consents.
              </p>
            </div>
            <button
              onClick={() => handlePrivacyAction('ACCESS_EXPORT')}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Request Export</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-red-50/50 border border-red-100">
            <div>
              <h3 className="text-xs font-bold text-red-900">Request Account & Record Deletion</h3>
              <p className="text-[11px] text-red-700">
                Subject to active booking completion, legal holds, and statutory taxation preservation rules.
              </p>
            </div>
            <button
              onClick={() => handlePrivacyAction('DELETION')}
              className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs rounded-lg flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Request Deletion</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-white border text-center space-y-3">
          <p className="text-xs text-gray-600 font-medium">
            Sign in with your verified mobile number to view and manage your data consents.
          </p>
          <button
            onClick={openAuthModal}
            className="px-5 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow"
          >
            Sign In to Access Data Rights
          </button>
        </div>
      )}
    </div>
  );
}
