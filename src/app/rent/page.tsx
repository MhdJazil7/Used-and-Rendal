'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/components/AppContext';
import {
  Car,
  Filter,
  CheckCircle2,
  MapPin,
  Fuel,
  Users,
  Search,
  Sparkles,
  SlidersHorizontal,
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
  'Alappuzha',
];

function RentSearchContent() {
  const searchParams = useSearchParams();
  const { t } = useApp();

  const [district, setDistrict] = useState(searchParams.get('district') || 'All Kerala');
  const [vehicleType, setVehicleType] = useState(searchParams.get('vehicleType') || 'ALL');
  const [transmission, setTransmission] = useState('ALL');
  const [fuelType, setFuelType] = useState('ALL');
  const [maxPrice, setMaxPrice] = useState(10000);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVehicles = () => {
    setLoading(true);
    const query = new URLSearchParams();
    if (district !== 'All Kerala') query.set('district', district);
    if (vehicleType !== 'ALL') query.set('vehicleType', vehicleType);
    if (transmission !== 'ALL') query.set('transmission', transmission);
    if (fuelType !== 'ALL') query.set('fuelType', fuelType);
    if (maxPrice < 10000) query.set('maxDailyPrice', maxPrice.toString());

    fetch(`/api/vehicles?${query.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data?.vehicles) {
          setVehicles(d.data.vehicles);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVehicles();
  }, [district, vehicleType, transmission, fuelType, maxPrice]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-gray-900">
          Find Rental Vehicles in Kerala
        </h1>
        <p className="text-xs sm:text-sm text-gray-500">
          Verified commercial & self-drive cars, SUVs, and scooters with transparent rates.
        </p>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
          <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
          <span>Server-Side Filters</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* District */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              District
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Vehicle Type
            </label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="HATCHBACK">Hatchback</option>
              <option value="SEDAN">Sedan</option>
              <option value="SUV">SUV (4x4)</option>
              <option value="MUV">MUV (7-Seater)</option>
              <option value="TWO_WHEELER">Two-Wheeler</option>
            </select>
          </div>

          {/* Transmission */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Transmission
            </label>
            <select
              value={transmission}
              onChange={(e) => setTransmission(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Transmissions</option>
              <option value="AUTOMATIC">Automatic</option>
              <option value="MANUAL">Manual</option>
            </select>
          </div>

          {/* Fuel */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Fuel Type
            </label>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-300 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Fuels</option>
              <option value="PETROL">Petrol</option>
              <option value="DIESEL">Diesel</option>
              <option value="ELECTRIC">Electric (EV)</option>
              <option value="HYBRID">Hybrid</option>
              <option value="CNG">CNG</option>
            </select>
          </div>

          {/* Max Daily Budget Slider */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-gray-400 mb-1">
              Max Daily: ₹{maxPrice}
            </label>
            <input
              type="range"
              min={800}
              max={10000}
              step={200}
              value={maxPrice}
              onChange={(e) => setMaxPrice(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-600"
            />
          </div>
        </div>
      </div>

      {/* Results Count & Grid */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <p className="text-xs font-bold text-gray-600">
            Showing <span className="text-emerald-700">{vehicles.length}</span> verified vehicle(s) in Kerala
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-72 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 space-y-3">
            <Car className="w-12 h-12 text-gray-300 mx-auto" />
            <h3 className="text-base font-bold text-gray-800">No vehicles match these filters</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Try adjusting your district or vehicle type filters.
            </p>
            <button
              onClick={() => {
                setDistrict('All Kerala');
                setVehicleType('ALL');
                setTransmission('ALL');
                setFuelType('ALL');
                setMaxPrice(5000);
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs shadow"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {vehicles.map((v) => (
              <div
                key={v.id}
                className="group flex flex-col rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition"
              >
                {/* Visual Header */}
                <div className="h-44 bg-gradient-to-br from-emerald-900 via-slate-800 to-slate-900 p-4 flex flex-col justify-between text-white">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm">
                      {v.vehicle_type}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Eligible & Insured
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold leading-tight">
                      {v.make} {v.model}
                    </h3>
                    <p className="text-xs text-emerald-200 font-medium">
                      {v.variant || v.transmission} • {v.manufacturing_year}
                    </p>
                  </div>
                </div>

                {/* Specs */}
                <div className="p-4 flex-grow flex flex-col justify-between space-y-4">
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-gray-100 text-center text-xs text-gray-600">
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-semibold">Fuel</p>
                      <p className="font-bold text-gray-800 mt-0.5">{v.fuel_type}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-semibold">Gearbox</p>
                      <p className="font-bold text-gray-800 mt-0.5">{v.transmission}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-gray-400 font-semibold">Seats</p>
                      <p className="font-bold text-gray-800 mt-0.5">{v.seat_count} Seats</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-600">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                        Pickup Area:
                      </span>
                      <span className="font-semibold text-gray-800">{v.approximate_area}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Security Deposit:</span>
                      <span className="font-semibold text-emerald-700">₹{v.security_deposit} (Refundable)</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Included Distance:</span>
                      <span className="font-semibold text-gray-800">{v.included_km_per_day} km/day</span>
                    </div>
                  </div>

                  {/* Price & CTA */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="text-xl font-black text-gray-900">₹{v.daily_price}</span>
                      <span className="text-xs text-gray-500 font-medium">/day</span>
                    </div>

                    <Link
                      href={`/rent/vehicle/${v.id}`}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition"
                    >
                      View & Book
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RentSearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto p-8 text-center text-xs text-gray-500">Loading rental vehicles...</div>}>
      <RentSearchContent />
    </Suspense>
  );
}
