'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Car,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Fuel,
  Gauge,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

function InspectionContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useApp();

  const mode = searchParams.get('mode') || 'pickup'; // 'pickup' or 'return'
  const isPickup = mode === 'pickup';

  const [booking, setBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [odometer, setOdometer] = useState<number>(15000);
  const [fuel, setFuel] = useState<number>(100);
  const [cleanliness, setCleanliness] = useState<number>(5);
  const [existingNotes, setExistingNotes] = useState<string>('No major visible dents');
  const [damagesFound, setDamagesFound] = useState<boolean>(false);
  const [damageClaimAmount, setDamageClaimAmount] = useState<number>(0);
  const [damageNotes, setDamageNotes] = useState<string>('');

  useEffect(() => {
    fetch(`/api/bookings/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.booking) {
          setBooking(d.data.booking);
          if (isPickup) {
            setOdometer(14200);
          } else {
            // Pre-fill with pickup odometer + 120km
            setOdometer((d.data.booking.pickup_odometer || 14200) + 120);
          }
        } else {
          setError(d.error?.message || 'Booking not found');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isPickup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const endpoint = isPickup ? '/api/inspections/pickup' : '/api/inspections/return';
      const body = isPickup
        ? {
            bookingId: id,
            odometerReading: Number(odometer),
            fuelPercentage: Number(fuel),
            cleanlinessRating: Number(cleanliness),
            existingScratchesNotes: existingNotes,
            accessoriesVerified: ['FASTAG', 'SPARE_TYRE', 'TOOLKIT', 'RC_COPY'],
            photos: ['mock_storage/pickup_front.jpg', 'mock_storage/pickup_odo.jpg'],
          }
        : {
            bookingId: id,
            odometerReading: Number(odometer),
            fuelPercentage: Number(fuel),
            newDamagesFound: damagesFound,
            damageNotes: damagesFound ? damageNotes : undefined,
            damageClaimAmount: damagesFound ? Number(damageClaimAmount) : undefined,
            damageCategory: damagesFound ? 'SCRATCH' : undefined,
            photos: ['mock_storage/return_front.jpg', 'mock_storage/return_odo.jpg'],
          };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Inspection recording failed');
      }

      setSuccessMsg(
        isPickup
          ? 'Pickup inspection completed successfully! Trip is now ACTIVE.'
          : 'Return inspection completed! Excess km and deposit settlement updated.'
      );

      setTimeout(() => {
        router.push(user?.roles.includes('OWNER') ? '/owner' : '/customer');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="max-w-md mx-auto p-12 text-center text-xs">Loading inspection checklist...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          Booking {booking?.booking_reference}
        </span>
        <h1 className="text-2xl font-black text-gray-900 mt-2">
          {isPickup ? 'Vehicle Pickup Handover Inspection' : 'Vehicle Return & Condition Check'}
        </h1>
        <p className="text-xs text-gray-500">
          {booking?.make} {booking?.model} • Recorded on an immutable audit trail.
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-5">
        {/* Odometer Input */}
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-emerald-600" />
            <span>Odometer Reading (km)</span>
          </label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(Number(e.target.value))}
            required
            className="w-full p-3 rounded-lg border border-gray-300 font-mono text-base font-bold"
          />
          {!isPickup && booking?.pickup_odometer && (
            <p className="text-[11px] text-gray-500 mt-1">
              Pickup odometer was: <strong>{booking.pickup_odometer} km</strong>. Return odometer cannot be less.
            </p>
          )}
        </div>

        {/* Fuel Percentage Slider */}
        <div>
          <label className="block text-xs font-bold uppercase text-gray-600 mb-1 flex items-center gap-1.5">
            <Fuel className="w-4 h-4 text-emerald-600" />
            <span>Fuel Level: {fuel}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={fuel}
            onChange={(e) => setFuel(Number(e.target.value))}
            className="w-full accent-emerald-600"
          />
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>Empty (0%)</span>
            <span>Quarter (25%)</span>
            <span>Half (50%)</span>
            <span>Full (100%)</span>
          </div>
        </div>

        {/* Pickup Specific: Accessories Checklist */}
        {isPickup && (
          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="block text-xs font-bold uppercase text-gray-600">
              Mandatory Accessories Verified
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
              <label className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50">
                <input type="checkbox" defaultChecked className="accent-emerald-600" />
                <span>Fastag Sticker Attached</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50">
                <input type="checkbox" defaultChecked className="accent-emerald-600" />
                <span>Spare Wheel & Jack</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50">
                <input type="checkbox" defaultChecked className="accent-emerald-600" />
                <span>Original / Attested RC</span>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border bg-gray-50">
                <input type="checkbox" defaultChecked className="accent-emerald-600" />
                <span>Sanitized Interior</span>
              </label>
            </div>
          </div>
        )}

        {/* Return Specific: Damage Detection */}
        {!isPickup && (
          <div className="space-y-3 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-800 cursor-pointer">
              <input
                type="checkbox"
                checked={damagesFound}
                onChange={(e) => setDamagesFound(e.target.checked)}
                className="w-4 h-4 accent-red-600"
              />
              <span>Report New Damage or Scratches Discovered</span>
            </label>

            {damagesFound && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-red-900 mb-1">Estimated Repair / Claim (₹)</label>
                  <input
                    type="number"
                    value={damageClaimAmount}
                    onChange={(e) => setDamageClaimAmount(Number(e.target.value))}
                    className="w-full p-2 rounded-lg border border-red-300 font-bold"
                  />
                  <p className="text-[10px] text-red-600 mt-1">
                    Cannot exceed total held security deposit. Customer will have the opportunity to accept or dispute.
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-red-900 mb-1">Damage Description</label>
                  <textarea
                    rows={2}
                    value={damageNotes}
                    onChange={(e) => setDamageNotes(e.target.value)}
                    placeholder="Describe exact scratch, dent, or mechanical issue..."
                    className="w-full p-2 rounded-lg border border-red-300"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Digital Signature Notice */}
        <div className="p-3 rounded-xl bg-gray-50 text-[11px] text-gray-500 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Both parties acknowledge these metrics as the basis for fuel and deposit settlement.</span>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting ? 'Submitting Inspection...' : isPickup ? 'Sign & Activate Trip' : 'Sign & Complete Trip'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

export default function InspectionPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto p-12 text-center text-xs text-gray-500">Loading inspection form...</div>}>
      <InspectionContent />
    </Suspense>
  );
}
