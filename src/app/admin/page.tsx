'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/components/AppContext';
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileText,
  DollarSign,
  Users,
  Car,
  Lock,
  Search,
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { user } = useApp();

  const [activeTab, setActiveTab] = useState<'VEHICLES' | 'RECONCILIATION' | 'DISPUTES' | 'RETENTION'>('VEHICLES');
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any | null>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [vRes, rRes, dRes] = await Promise.all([
        fetch('/api/vehicles?limit=50'),
        fetch('/api/admin/reconciliation'),
        fetch('/api/disputes'),
      ]);

      const vData = await vRes.json();
      const rData = await rRes.json();
      const dData = await dRes.json();

      if (vData.success) setVehicles(vData.data?.vehicles || []);
      if (rData.success) setReconciliation(rData.data || null);
      if (dData.success) setDisputes(dData.data?.disputes || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleVehicleAction = async (vehicleId: string, action: 'APPROVE' | 'REJECT' | 'SUSPEND') => {
    setActionLoading(vehicleId);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/vehicles/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, action, notes: `Reviewed by admin on ${new Date().toISOString()}` }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Action failed');
      }
      setMessage(`Vehicle ${action.toLowerCase()}d successfully.`);
      fetchAdminData();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunRetention = async () => {
    setActionLoading('retention');
    try {
      const res = await fetch('/api/admin/retention/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMessage(
          `Retention sweep completed. Evaluated: ${data.data.recordsEvaluated}, Anonymized: ${data.data.anonymizedCount}, Held: ${data.data.skippedLegalHolds}`
        );
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-600" />
            <h1 className="text-2xl font-black text-gray-900">Kerala Operations & Governance</h1>
          </div>
          <p className="text-xs text-gray-500">
            Authoritative fleet compliance, double-entry financial ledger reconciliation, and legal retention.
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh All</span>
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-2 text-xs font-bold">
        <button
          onClick={() => setActiveTab('VEHICLES')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'VEHICLES' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Fleet Review ({vehicles.length})
        </button>

        <button
          onClick={() => setActiveTab('RECONCILIATION')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'RECONCILIATION' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Ledger & Payment Reconciliation
        </button>

        <button
          onClick={() => setActiveTab('DISPUTES')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'DISPUTES' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Disputes ({disputes.length})
        </button>

        <button
          onClick={() => setActiveTab('RETENTION')}
          className={`px-4 py-2 rounded-xl transition ${
            activeTab === 'RETENTION' ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Privacy & Legal Retention
        </button>
      </div>

      {/* Tab 1: Fleet Review */}
      {activeTab === 'VEHICLES' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-gray-900">
                      {v.make} {v.model} ({v.manufacturing_year})
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {v.district}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {v.vehicle_category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Daily Rate: ₹{v.daily_price} • Security Deposit: ₹{v.security_deposit} • Area: {v.approximate_area}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVehicleAction(v.id, 'APPROVE')}
                    disabled={actionLoading === v.id}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm"
                  >
                    Approve / Live
                  </button>

                  <button
                    onClick={() => handleVehicleAction(v.id, 'SUSPEND')}
                    disabled={actionLoading === v.id}
                    className="px-3 py-1.5 border border-amber-300 text-amber-800 hover:bg-amber-50 text-xs font-bold rounded-lg"
                  >
                    Suspend
                  </button>

                  <button
                    onClick={() => handleVehicleAction(v.id, 'REJECT')}
                    disabled={actionLoading === v.id}
                    className="px-3 py-1.5 border border-red-300 text-red-700 hover:bg-red-50 text-xs font-bold rounded-lg"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Financial Reconciliation */}
      {activeTab === 'RECONCILIATION' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
            <h3 className="font-bold text-sm text-gray-900">Three-Way Ledger Reconciliation</h3>
            <p className="text-xs text-gray-500">
              Validates that application price snapshots, payment provider orders, and completed transactions match rupee-for-rupee.
            </p>
          </div>

          <div className="rounded-2xl bg-white border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] border-b">
                <tr>
                  <th className="p-3">Booking Ref</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Expected Amount</th>
                  <th className="p-3">Paid Amount</th>
                  <th className="p-3">Deposit Held</th>
                  <th className="p-3">Audit Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(reconciliation?.items || []).map((item: any) => (
                  <tr key={item.booking_id}>
                    <td className="p-3 font-mono font-bold text-gray-900">{item.booking_reference}</td>
                    <td className="p-3 font-medium">{item.booking_status}</td>
                    <td className="p-3 font-bold text-gray-900">₹{item.snapshot_expected_total}</td>
                    <td className="p-3">₹{item.transaction_paid_amount}</td>
                    <td className="p-3 text-emerald-700">₹{item.deposit_held}</td>
                    <td className="p-3">
                      <span className="font-bold text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {item.reconciliation_flag}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Disputes */}
      {activeTab === 'DISPUTES' && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border text-xs text-gray-500">
              Zero active disputes. All rentals settled cleanly.
            </div>
          ) : (
            disputes.map((d) => (
              <div key={d.id} className="p-4 rounded-2xl bg-white border border-red-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono font-bold text-red-700">{d.category}</span>
                  <span className="font-bold text-gray-700">Status: {d.status}</span>
                </div>
                <p className="text-xs text-gray-600">{d.description}</p>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: Retention */}
      {activeTab === 'RETENTION' && (
        <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4">
          <h3 className="font-bold text-base text-gray-900">Automated Data Retention Engine</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            Evaluates expired KYC records. Automatically checks for active legal holds, ongoing disputes, or statutory tax preservation requirements before executing anonymization.
          </p>

          <button
            onClick={handleRunRetention}
            disabled={actionLoading === 'retention'}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow disabled:opacity-50"
          >
            {actionLoading === 'retention' ? 'Running Sweep...' : 'Execute Retention Sweep Now'}
          </button>
        </div>
      )}
    </div>
  );
}
