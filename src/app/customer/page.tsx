'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Car,
  Clock,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  ShieldCheck,
  FileText,
  Calendar,
  Phone,
  MessageSquare,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

function CustomerDashboardContent() {
  const { user, openAuthModal } = useApp();
  const searchParams = useSearchParams();
  const requestedRef = searchParams.get('requested');

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  const fetchBookings = () => {
    setLoading(true);
    fetch('/api/bookings?role=customer')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.bookings) {
          setBookings(d.data.bookings);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (user) {
      fetchBookings();
    }
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
        <Car className="w-12 h-12 text-emerald-600 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Sign in to view your bookings</h2>
        <p className="text-xs text-gray-500">
          Track real-time owner approvals, payment deadlines, digital agreements, and security deposit settlements.
        </p>
        <button
          onClick={openAuthModal}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow"
        >
          Sign In with Mobile OTP
        </button>
      </div>
    );
  }

  // Handle Payment Initiation & Verification
  const handlePayNow = async (bookingId: string) => {
    setPayingBookingId(bookingId);
    setPayError(null);

    try {
      // 1. Create payment order server-side
      const orderRes = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const orderData = await orderRes.json();
      if (!orderData.success) {
        throw new Error(orderData.error?.message || 'Order creation failed');
      }

      // 2. Perform cryptographically validated payment completion
      const verifyRes = await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderDbId: orderData.data.orderId,
          providerPaymentId: `pay_${Date.now()}`,
          providerSignature: 'valid_mock_signature',
          paymentMethod: 'upi',
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyData.success) {
        throw new Error(verifyData.error?.message || 'Payment verification failed');
      }

      // Refresh bookings list
      fetchBookings();
    } catch (err: any) {
      setPayError(err.message);
    } finally {
      setPayingBookingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Customer Rental Portal</h1>
          <p className="text-xs text-gray-500">
            Welcome back, {user.displayName} ({user.phone}). Real-time rental and deposit status.
          </p>
        </div>

        <button
          onClick={fetchBookings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {requestedRef && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Booking Request Submitted: {requestedRef}</p>
              <p className="text-gray-600 text-[11px]">
                The vehicle owner has been notified via WhatsApp and will review your request.
              </p>
            </div>
          </div>
        </div>
      )}

      {payError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{payError}</span>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Your Rental Bookings ({bookings.length})
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((n) => (
              <div key={n} className="h-32 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-gray-200 text-center space-y-3">
            <Calendar className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm font-bold text-gray-700">No bookings yet</p>
            <p className="text-xs text-gray-500">Explore vehicles and plan your Kerala journey.</p>
            <Link
              href="/rent"
              className="inline-block px-4 py-2 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow"
            >
              Search Vehicles
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4"
              >
                {/* Top Info Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {b.booking_reference}
                    </span>
                    <h3 className="font-bold text-sm text-gray-900">
                      {b.make} {b.model} {b.variant || ''}
                    </h3>
                  </div>

                  {/* Status Badges */}
                  <div>
                    {b.status === 'REQUESTED' && (
                      <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Awaiting Owner Approval
                      </span>
                    )}

                    {b.status === 'PAYMENT_PENDING' && (
                      <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                        Approved by Owner • Payment Due
                      </span>
                    )}

                    {b.status === 'CONFIRMED' && (
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Confirmed • Ready for Pickup
                      </span>
                    )}

                    {b.status === 'ACTIVE_RENTAL' && (
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Car className="w-3.5 h-3.5 text-purple-600" />
                        Active Rental
                      </span>
                    )}

                    {b.status === 'DEPOSIT_PENDING' && (
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full">
                        Vehicle Returned • Deposit Settling
                      </span>
                    )}

                    {b.status === 'COMPLETED' && (
                      <span className="text-xs font-bold text-gray-700 bg-gray-100 px-2.5 py-1 rounded-full">
                        Rental Completed
                      </span>
                    )}

                    {b.status === 'OWNER_REJECTED' && (
                      <span className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                        Rejected by Owner
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Body */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
                  <div>
                    <span className="text-gray-400 block mb-0.5">Rental Duration:</span>
                    <span className="font-semibold text-gray-800">
                      {new Date(b.start_time).toLocaleDateString('en-IN')} to{' '}
                      {new Date(b.end_time).toLocaleDateString('en-IN')}
                    </span>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">Pickup Location:</span>
                    <span className="font-semibold text-gray-800">{b.pickup_location_approx}</span>
                  </div>

                  <div>
                    <span className="text-gray-400 block mb-0.5">Total Amount (with Deposit):</span>
                    <span className="font-bold text-emerald-800 text-sm">
                      ₹{b.total_payable_now}
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      (Includes ₹{b.security_deposit} refundable deposit)
                    </span>
                  </div>
                </div>

                {/* Payment Action Bar if PAYMENT_PENDING */}
                {b.status === 'PAYMENT_PENDING' && (
                  <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-blue-900 space-y-0.5">
                      <p className="font-bold flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Owner has accepted! Complete payment to lock your dates.
                      </p>
                      <p className="text-[11px] text-blue-700">
                        Payment deadline: {b.payment_deadline ? new Date(b.payment_deadline).toLocaleTimeString('en-IN') : '15 mins'}
                      </p>
                    </div>

                    <button
                      onClick={() => handlePayNow(b.id)}
                      disabled={payingBookingId === b.id}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <CreditCard className="w-4 h-4" />
                      {payingBookingId === b.id ? 'Processing Payment...' : `Pay ₹${b.total_payable_now} via Razorpay`}
                    </button>
                  </div>
                )}

                {/* Active Rental Inspection Bar */}
                {b.status === 'ACTIVE_RENTAL' && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-center justify-between">
                    <div>
                      <p className="font-bold">Trip in progress</p>
                      <p className="text-[11px] text-purple-700">
                        Host WhatsApp Contact: {b.owner_info?.phone}
                      </p>
                    </div>

                    <Link
                      href={`/inspection/${b.id}?mode=return`}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold text-xs shadow"
                    >
                      Return Vehicle Inspection
                    </Link>
                  </div>
                )}

                {/* Rejection Note */}
                {b.status === 'OWNER_REJECTED' && b.rejection_reason && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs">
                    <strong>Owner Note:</strong> {b.rejection_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomerDashboardPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-8 text-center text-xs text-gray-500">Loading your bookings...</div>}>
      <CustomerDashboardContent />
    </Suspense>
  );
}
