'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Car,
  Search,
  ShieldCheck,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  MessageSquare,
  ArrowRight,
  Sparkles,
  Zap,
} from 'lucide-react';

const KERALA_DISTRICTS = [
  'All Kerala',
  'Ernakulam',
  'Thiruvananthapuram',
  'Kozhikode',
  'Thrissur',
  'Kottayam',
  'Malappuram',
  'Palakkad',
  'Kannur',
  'Kollam',
  'Alappuzha',
  'Idukki',
  'Pathanamthitta',
  'Kasaragod',
  'Wayanad',
];

export default function HomePage() {
  const { t, openAuthModal, user } = useApp();
  const router = useRouter();

  const [district, setDistrict] = useState('All Kerala');
  const [vehicleType, setVehicleType] = useState('ALL');
  const [pickupDate, setPickupDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [featuredVehicles, setFeaturedVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Default search dates (tomorrow 9 AM to 3 days later 9 AM)
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 2);

    setPickupDate(start.toISOString().split('T')[0]);
    setReturnDate(end.toISOString().split('T')[0]);

    // Fetch live vehicles
    fetch('/api/vehicles?limit=4')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.vehicles) {
          setFeaturedVehicles(d.data.vehicles);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const query = new URLSearchParams();
    if (district !== 'All Kerala') query.set('district', district);
    if (vehicleType !== 'ALL') query.set('vehicleType', vehicleType);
    if (pickupDate) query.set('pickupDate', pickupDate);
    if (returnDate) query.set('returnDate', returnDate);
    router.push(`/rent?${query.toString()}`);
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-b from-emerald-50/70 via-white to-white pt-8 pb-14 px-4 sm:px-6 lg:px-8 border-b border-gray-100">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Kerala's First WhatsApp-Integrated Rental Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 tracking-tight leading-tight">
            {t('hero_title')}
          </h1>

          <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto leading-relaxed">
            {t('hero_subtitle')}
          </p>

          {/* Search Box Card */}
          <div className="mt-8 rounded-2xl bg-white p-5 shadow-xl border border-gray-200 text-left">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* District */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    {t('pickup_location')}
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {KERALA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Type */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-emerald-600" />
                    {t('vehicle_type')}
                  </label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="ALL">All Types</option>
                    <option value="HATCHBACK">Hatchback (Swift, i10)</option>
                    <option value="SEDAN">Sedan (Dzire, City)</option>
                    <option value="SUV">SUV (Thar, Creta, Nexon)</option>
                    <option value="MUV">MUV (Innova, Ertiga)</option>
                    <option value="TWO_WHEELER">Two-Wheeler / Scooter</option>
                  </select>
                </div>

                {/* Pickup Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    {t('pickup_date')}
                  </label>
                  <input
                    type="date"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Return Date */}
                <div>
                  <label className="block text-[11px] font-bold uppercase text-gray-500 mb-1 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    {t('return_date')}
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>No hidden charges: daily rent + refundable deposit displayed upfront.</span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="submit"
                    className="flex-1 sm:flex-initial flex items-center justify-center gap-2 py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
                  >
                    <Search className="w-4 h-4" />
                    {t('search_vehicles')}
                  </button>

                  <Link
                    href="/owner"
                    className="hidden sm:inline-flex items-center gap-1.5 py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs transition"
                  >
                    {t('list_vehicle')}
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Trust & Verification Pillar Concepts */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            Why Rent Through KeralaDrive?
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Built with strict security guardrails, data minimization, and verified transport rules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">{t('trust_verified_title')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{t('trust_verified_desc')}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">{t('trust_owner_confirm_title')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{t('trust_owner_confirm_desc')}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">{t('trust_deposit_title')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{t('trust_deposit_desc')}</p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-gray-900">{t('trust_whatsapp_title')}</h3>
            <p className="text-xs text-gray-500 leading-relaxed">{t('trust_whatsapp_desc')}</p>
          </div>
        </div>
      </section>

      {/* Featured Vehicles Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Verified Rental Cars in Kerala
            </h2>
            <p className="text-xs text-gray-500">
              Live listings with transparent pricing in Kochi, Trivandrum & Calicut
            </p>
          </div>

          <Link
            href="/rent"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featuredVehicles.map((v) => (
              <div
                key={v.id}
                className="group flex flex-col rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                {/* Vehicle Placeholder / Image Header */}
                <div className="h-40 bg-gradient-to-br from-emerald-800 to-slate-900 p-4 flex flex-col justify-between text-white relative">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                      {v.vehicle_type}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Verified
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold leading-tight">
                      {v.make} {v.model}
                    </h3>
                    <p className="text-xs text-emerald-200">{v.variant || v.transmission}</p>
                  </div>
                </div>

                {/* Details */}
                <div className="p-4 flex-grow flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Location:</span>
                      <span className="font-semibold text-gray-800">{v.approximate_area}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Transmission & Fuel:</span>
                      <span className="font-semibold text-gray-800">
                        {v.transmission} • {v.fuel_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Deposit:</span>
                      <span className="font-semibold text-emerald-700">₹{v.security_deposit}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-lg font-black text-gray-900">₹{v.daily_price}</span>
                      <span className="text-[11px] text-gray-500">{t('per_day')}</span>
                    </div>

                    <Link
                      href={`/rent/vehicle/${v.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition"
                    >
                      {t('view_details')}
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
