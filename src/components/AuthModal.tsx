'use client';

import React, { useState } from 'react';
import { useApp } from './AppContext';
import { X, Phone, ShieldCheck, KeyRound, ArrowRight } from 'lucide-react';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, refreshSession } = useApp();
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [phone, setPhone] = useState('+919846011111');
  const [otp, setOtp] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  if (!isAuthModalOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to send OTP');
      }
      if (data.data?.devOtp) {
        setDevOtpHint(data.data.devOtp);
        setOtp(data.data.devOtp);
      }
      setStep('OTP');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Invalid OTP');
      }
      await refreshSession();
      closeAuthModal();
      setStep('PHONE');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setQuickUser = (p: string) => {
    setPhone(p);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={closeAuthModal}
          className="absolute right-4 top-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Secure Kerala Auth</h2>
            <p className="text-xs text-gray-500">Fast phone OTP verification</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {step === 'PHONE' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98460 XXXXX"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Enter your WhatsApp/SMS enabled phone number.
              </p>
            </div>

            {/* Development Quick Role Switcher */}
            <div className="pt-2 border-t border-gray-100">
              <span className="text-[11px] font-semibold text-gray-400 block mb-1">
                Demo Accounts for Testing:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setQuickUser('+919846011111')}
                  className="p-1.5 rounded border border-gray-200 hover:bg-emerald-50 text-gray-700 text-center font-medium"
                >
                  Customer 1
                </button>
                <button
                  type="button"
                  onClick={() => setQuickUser('+919846033333')}
                  className="p-1.5 rounded border border-gray-200 hover:bg-emerald-50 text-gray-700 text-center font-medium"
                >
                  Owner 1 (Mathew)
                </button>
                <button
                  type="button"
                  onClick={() => setQuickUser('+919846099999')}
                  className="p-1.5 rounded border border-purple-200 hover:bg-purple-50 text-purple-700 text-center font-medium"
                >
                  Platform Admin
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Sending OTP...' : 'Send Verification OTP'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold uppercase text-gray-600">
                  Enter 6-Digit OTP
                </label>
                <button
                  type="button"
                  onClick={() => setStep('PHONE')}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  Change phone
                </button>
              </div>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="123456"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-center text-lg tracking-widest font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              {devOtpHint && (
                <p className="text-[11px] text-emerald-600 mt-1.5 font-medium">
                  Test OTP code: <span className="font-mono bg-emerald-100 px-1 py-0.5 rounded">{devOtpHint}</span>
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-md disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Continue'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="mt-4 pt-3 border-t border-gray-100 text-center text-[11px] text-gray-400">
          By signing in you accept the Kerala Vehicle Rental Marketplace Terms & Privacy Policy.
        </div>
      </div>
    </div>
  );
}
