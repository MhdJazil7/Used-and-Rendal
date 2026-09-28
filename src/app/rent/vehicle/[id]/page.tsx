'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Car,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  Sparkles,
  ArrowRight,
  Info,
  Fuel,
  Users,
  MessageSquare,
} from 'lucide-react';

export default function VehicleDetailPage() {
  const { id } = useParams();
  const { user, openAuthModal } = useApp();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Date selection state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [requestLoading, setRequestLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    // Default dates
    const today = new Date();
    const d1 = new Date(today);
    d1.setDate(today.getDate() + 1);
    const d2 = new Date(d1);
    d2.setDate(d1.getDate() + 2);

    setStartDate(d1.toISOString().slice(0, 16));
    setEndDate(d2.toISOString().slice(0, 16));

    fetch(`/api/vehicles/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.vehicle) {
          setVehicle(d.data.vehicle);
        } else {
          setError(d.error?.message || 'Vehicle not found');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-xs text-gray-500 font-semibold">Loading vehicle details...</p>
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-gray-900">{error || 'Vehicle not found'}</h2>
        <Link
          href="/rent"
          className="inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold"
        >
          Back to Search
        </Link>
      </div>
    );
  }

  // Calculate duration and estimate
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const estRental = diffDays * Number(vehicle.daily_price);
  const estPlatFee = Math.round(estRental * 0.1);
  const estTax = Math.round(estPlatFee * 0.18);
  const secDeposit = Number(vehicle.security_deposit);
  const totalEst = estRental + estPlatFee + estTax + secDeposit;

  const handleBookingRequest = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    setRequestLoading(true);
    setBookingError(null);

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: vehicle.id,
          startTime: new Date(startDate).toISOString(),
          endTime: new Date(endDate).toISOString(),
          pickupLocationApprox: vehicle.approximate_area,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Booking request failed');
      }

      // Redirect to customer dashboard
      router.push(`/customer?requested=${data.data.bookingReference}`);
    } catch (err: any) {
      setBookingError(err.message);
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-gray-500 flex items-center gap-2">
        <Link href="/rent" className="hover:text-emerald-600">Rentals</Link>
        <span>/</span>
        <span className="text-gray-800 font-semibold">{vehicle.district}</span>
        <span>/</span>
        <span className="text-gray-900">{vehicle.make} {vehicle.model}</span>
      </nav>

      {/* Main Vehicle Header Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Visual Showcase */}
          <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 p-8 text-white shadow-xl relative overflow-hidden">
            <div className="relative z-10 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider px-3 py-1 rounded-full bg-white/20 backdrop-blur-md">
                  {vehicle.vehicle_type}
                </span>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-4 h-4" />
                  Commercial Rental Eligibility Verified
                </span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                {vehicle.make} {vehicle.model}
              </h1>

              <p className="text-emerald-200 text-sm font-medium">
                {vehicle.variant} • Year {vehicle.manufacturing_year} • {vehicle.colour}
              </p>

              <div className="flex items-center gap-2 text-xs text-gray-300 pt-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>Pickup Location: <strong>{vehicle.approximate_area}, {vehicle.district}</strong></span>
              </div>
            </div>
          </div>

          {/* Key Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-white border border-gray-200 shadow-sm text-center">
            <div>
              <p className="text-[11px] uppercase font-bold text-gray-400">Transmission</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{vehicle.transmission}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-gray-400">Fuel Type</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{vehicle.fuel_type}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-gray-400">Seating</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{vehicle.seat_count} Seats</p>
            </div>
            <div>
              <p className="text-[11px] uppercase font-bold text-gray-400">Rental Mode</p>
              <p className="text-sm font-bold text-emerald-700 mt-1">{vehicle.rental_mode.replace('_', ' ')}</p>
            </div>
          </div>

          {/* Description & Features */}
          <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4">
            <h3 className="text-base font-bold text-gray-900">Vehicle Description & Features</h3>
            <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
              {vehicle.description || 'Clean, sanitized, and regularly maintained self-drive car in Kerala.'}
            </p>

            <div>
              <h4 className="text-xs font-bold uppercase text-gray-400 mb-2">Equipped Features</h4>
              <div className="flex flex-wrap gap-2">
                {(vehicle.features || []).map((f: string, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gray-100 text-gray-800 text-xs font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Rental Rules & Safeguards */}
          <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
            <h3 className="text-base font-bold text-gray-900">Rental Terms & Safeguards</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900">Driving License Requirement</p>
                <p>Valid Indian / International LMV license. Min driver age: {vehicle.min_driver_age || 21} years.</p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900">Fuel Policy: {vehicle.fuel_policy}</p>
                <p>Return at the same fuel level as received. Recorded on photographic pickup checklist.</p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900">Included Distance</p>
                <p>{vehicle.included_km_per_day} km/day included. Extra km charged at ₹{vehicle.extra_km_price}/km.</p>
              </div>

              <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
                <p className="font-semibold text-gray-900">Speed Limit & Safety</p>
                <p>Maximum permitted speed: {vehicle.speed_limit_kmh || 90} km/h according to Kerala Transport limits.</p>
              </div>
            </div>
          </div>

          {/* Owner Trust Card */}
          <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm">
                {vehicle.owner_info?.display_name?.charAt(0) || 'H'}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Hosted by</p>
                <p className="text-sm font-bold text-gray-900">{vehicle.owner_info?.display_name || 'Verified Host'}</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-bold bg-white px-3 py-1.5 rounded-xl border border-emerald-200 shadow-sm">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Identity ✓ Verified</span>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Transparent Pricing & Request Booking Card */}
        <div>
          <div className="sticky top-24 rounded-3xl bg-white border border-gray-200 p-6 shadow-xl space-y-5">
            <div>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-gray-900">₹{vehicle.daily_price}</span>
                  <span className="text-xs text-gray-500 font-medium"> / day</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Direct Owner Rate
                </span>
              </div>
            </div>

            {/* Dates Selection */}
            <div className="space-y-3 pt-3 border-t border-gray-100">
              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Pickup Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1">
                  Return Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Transparent Cost Breakdown */}
            <div className="space-y-2 pt-3 border-t border-gray-100 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Rental ({diffDays} day{diffDays > 1 ? 's' : ''}):</span>
                <span className="font-bold text-gray-900">₹{estRental}</span>
              </div>
              <div className="flex justify-between">
                <span>Platform Service Fee:</span>
                <span>₹{estPlatFee}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (18% on platform fee):</span>
                <span>₹{estTax}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Security Deposit (100% Refundable):</span>
                <span>₹{secDeposit}</span>
              </div>

              <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline text-sm font-black text-gray-900">
                <span>Total Payable Upon Approval:</span>
                <span className="text-xl text-emerald-800">₹{totalEst}</span>
              </div>
            </div>

            {bookingError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                {bookingError}
              </div>
            )}

            {/* Booking Notice */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <p className="font-bold flex items-center gap-1 mb-0.5">
                <Info className="w-3.5 h-3.5 text-amber-600" />
                Owner Manual Approval Enforced
              </p>
              Your card is NOT charged now. The vehicle owner manually reviews your request first. If accepted, you will have a 15-minute secure payment window.
            </div>

            {/* CTA */}
            <button
              onClick={handleBookingRequest}
              disabled={requestLoading}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {requestLoading ? 'Submitting Request...' : 'Request Rental Booking'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
