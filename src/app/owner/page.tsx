'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppContext';
import {
  Car,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  RefreshCw,
  FileCheck,
  ChevronRight,
  TrendingUp,
  CreditCard,
} from 'lucide-react';

export default function OwnerDashboardPage() {
  const { user, openAuthModal } = useApp();

  const [bookings, setBookings] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [rejectModalBookingId, setRejectModalBookingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Vehicle unavailable on requested dates');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New vehicle form state
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleType: 'CAR',
    make: 'Hyundai',
    model: 'i20',
    variant: 'Asta Dual Tone',
    manufacturingYear: 2023,
    registrationYear: 2023,
    fuelType: 'PETROL',
    transmission: 'AUTOMATIC',
    seatCount: 5,
    colour: 'Fiery Red',
    odometerKm: 18000,
    vehicleCategory: 'COMMERCIAL_RENTAL',
    rentalMode: 'SELF_DRIVE',
    registrationNumber: 'KL 07 CY 4444',
    registeredOwnerName: 'Mathew Thomas',
    district: 'Ernakulam',
    city: 'Kochi',
    approximateArea: 'Edappally Toll',
    dailyPrice: 2000,
    securityDeposit: 4000,
    includedKmPerDay: 200,
    extraKmPrice: 10,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, vRes] = await Promise.all([
        fetch('/api/bookings?role=owner'),
        fetch('/api/vehicles?limit=50'),
      ]);

      const bData = await bRes.json();
      const vData = await vRes.json();

      if (bData.success && bData.data?.bookings) {
        setBookings(bData.data.bookings);
      }
      if (vData.success && vData.data?.vehicles) {
        setVehicles(vData.data.vehicles);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Car className="w-12 h-12 text-emerald-600 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Sign in to Owner Dashboard</h2>
        <p className="text-xs text-gray-500">
          Manage rental requests, accept bookings, verify customer KYC status, and inspect vehicles.
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
        >
          Sign In as Owner
        </button>
      </div>
    );
  }

  // Handle Owner Acceptance (Atomic Concurrency Hold)
  const handleAccept = async (bookingId: string) => {
    setActionLoadingId(bookingId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/accept`, { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to accept booking');
      }
      setFeedbackMsg({
        type: 'success',
        text: 'Booking accepted! 15-minute payment hold created. Customer notified via WhatsApp.',
      });
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Owner Rejection
  const handleReject = async () => {
    if (!rejectModalBookingId) return;
    setActionLoadingId(rejectModalBookingId);
    setFeedbackMsg(null);
    try {
      const res = await fetch(`/api/bookings/${rejectModalBookingId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to reject booking');
      }
      setFeedbackMsg({ type: 'success', text: 'Booking rejected and slot released.' });
      setRejectModalBookingId(null);
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle New Vehicle Submission
  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoadingId('new_veh');
    setFeedbackMsg(null);
    try {
      const res = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVehicle),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to list vehicle');
      }
      setFeedbackMsg({
        type: 'success',
        text: 'Vehicle submitted for admin eligibility review and commercial compliance verification!',
      });
      setShowAddVehicle(false);
      fetchData();
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.message });
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingRequests = bookings.filter((b) => b.status === 'REQUESTED');
  const activeBookings = bookings.filter(
    (b) => b.status === 'CONFIRMED' || b.status === 'ACTIVE_RENTAL' || b.status === 'PAYMENT_PENDING'
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Host & Fleet Operations</h1>
          <p className="text-xs text-gray-500">
            Logged in as {user.displayName} • Kerala Fleet Host
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{showAddVehicle ? 'Close Form' : 'Add Vehicle'}</span>
          </button>

          <button
            onClick={fetchData}
            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-[11px] uppercase font-bold text-gray-400">Pending Requests</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{pendingRequests.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-[11px] uppercase font-bold text-gray-400">Active / Confirmed Trips</span>
          <p className="text-2xl font-black text-emerald-700 mt-1">{activeBookings.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-[11px] uppercase font-bold text-gray-400">Listed Vehicles</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{vehicles.length}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm">
          <span className="text-[11px] uppercase font-bold text-gray-400">Payout Status</span>
          <p className="text-2xl font-black text-blue-700 mt-1">₹0.00 Due</p>
        </div>
      </div>

      {/* Add Vehicle Modal / Inline Form */}
      {showAddVehicle && (
        <div className="p-6 rounded-2xl bg-white border border-emerald-200 shadow-lg space-y-4">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-emerald-600" />
            <span>List a New Vehicle in Kerala</span>
          </h2>
          <p className="text-xs text-gray-500">
            Adheres to Kerala Rent-a-Cab guidelines. Vehicle will be routed to manual admin review before going live.
          </p>

          <form onSubmit={handleCreateVehicle} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-gray-700 mb-1">Make</label>
              <input
                type="text"
                value={newVehicle.make}
                onChange={(e) => setNewVehicle({ ...newVehicle, make: e.target.value })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Model</label>
              <input
                type="text"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div>
              <label className="block font-bold text-gray-700 mb-1">Variant</label>
              <input
                type="text"
                value={newVehicle.variant}
                onChange={(e) => setNewVehicle({ ...newVehicle, variant: e.target.value })}
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Registration Number</label>
              <input
                type="text"
                value={newVehicle.registrationNumber}
                onChange={(e) => setNewVehicle({ ...newVehicle, registrationNumber: e.target.value })}
                required
                className="w-full p-2 border rounded-lg font-mono uppercase"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">District</label>
              <input
                type="text"
                value={newVehicle.district}
                onChange={(e) => setNewVehicle({ ...newVehicle, district: e.target.value })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Pickup Area</label>
              <input
                type="text"
                value={newVehicle.approximateArea}
                onChange={(e) => setNewVehicle({ ...newVehicle, approximateArea: e.target.value })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Daily Price (₹)</label>
              <input
                type="number"
                value={newVehicle.dailyPrice}
                onChange={(e) => setNewVehicle({ ...newVehicle, dailyPrice: Number(e.target.value) })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Security Deposit (₹)</label>
              <input
                type="number"
                value={newVehicle.securityDeposit}
                onChange={(e) => setNewVehicle({ ...newVehicle, securityDeposit: Number(e.target.value) })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block font-bold text-gray-700 mb-1">Included km / day</label>
              <input
                type="number"
                value={newVehicle.includedKmPerDay}
                onChange={(e) => setNewVehicle({ ...newVehicle, includedKmPerDay: Number(e.target.value) })}
                required
                className="w-full p-2 border rounded-lg"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="px-4 py-2 border rounded-lg text-gray-600 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoadingId === 'new_veh'}
                className="px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg shadow"
              >
                {actionLoadingId === 'new_veh' ? 'Submitting...' : 'Submit Vehicle'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pending Rental Requests (Section 56: Mandatory Manual Owner Decision) */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Pending Rental Requests Awaiting Your Decision ({pendingRequests.length})</span>
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="p-6 rounded-2xl bg-white border border-gray-200 text-center text-xs text-gray-500">
            No pending booking requests at this time.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-5 rounded-2xl bg-white border border-amber-200 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      {req.booking_reference}
                    </span>
                    <h3 className="font-bold text-base text-gray-900 mt-1">
                      {req.make} {req.model}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Non-Negotiable Privacy Guardrail: KYC Badge only, NO RAW AADHAAR */}
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Customer Identity: ✓ Verified</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Customer:</span>
                    <span className="font-bold text-gray-900">{req.customer_info?.display_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Dates:</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(req.start_time).toLocaleDateString('en-IN')} to{' '}
                      {new Date(req.end_time).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Rental Earnings:</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      ₹{req.rental_amount}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-0.5">Deposit Held:</span>
                    <span className="font-semibold text-gray-800">₹{req.security_deposit}</span>
                  </div>
                </div>

                {/* Accept / Reject Buttons */}
                <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-[11px] text-gray-400">
                    Accepting creates an exclusive 15-minute hold preventing overlapping bookings.
                  </p>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => setRejectModalBookingId(req.id)}
                      disabled={actionLoadingId === req.id}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-red-200 hover:bg-red-50 text-red-700 font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleAccept(req.id)}
                      disabled={actionLoadingId === req.id}
                      className="flex-1 sm:flex-initial px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{actionLoadingId === req.id ? 'Accepting...' : 'Accept Booking'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {rejectModalBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-gray-900">Why are you rejecting this request?</h3>
            <p className="text-xs text-gray-500">
              Provide a clear reason for the customer notification.
            </p>

            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 rounded-lg border border-gray-300 text-xs font-medium"
            >
              <option value="Vehicle unavailable on requested dates">Vehicle unavailable on requested dates</option>
              <option value="Vehicle undergoing scheduled maintenance">Vehicle undergoing scheduled maintenance</option>
              <option value="Customer route unsuitable for vehicle type">Customer route unsuitable for vehicle type</option>
              <option value="Personal schedule conflict">Personal schedule conflict</option>
              <option value="Other">Other</option>
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectModalBookingId(null)}
                className="px-4 py-2 border rounded-lg text-xs font-semibold text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmed / Active Bookings & Pickup Inspection Controls */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Active & Confirmed Rentals ({activeBookings.length})
        </h2>

        <div className="grid grid-cols-1 gap-4">
          {activeBookings.map((b) => (
            <div
              key={b.id}
              className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {b.booking_reference}
                  </span>
                  <h3 className="font-bold text-sm text-gray-900">
                    {b.make} {b.model}
                  </h3>
                </div>

                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                  {b.status.replace('_', ' ')}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-gray-400">Customer Contact: </span>
                  <span className="font-bold text-gray-900">{b.customer_info?.phone}</span>
                </div>

                <div className="flex items-center gap-2">
                  {b.status === 'CONFIRMED' && (
                    <Link
                      href={`/inspection/${b.id}?mode=pickup`}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                    >
                      Complete Handover Inspection
                    </Link>
                  )}

                  {b.status === 'ACTIVE_RENTAL' && (
                    <Link
                      href={`/inspection/${b.id}?mode=return`}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-sm"
                    >
                      Perform Return Inspection
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
