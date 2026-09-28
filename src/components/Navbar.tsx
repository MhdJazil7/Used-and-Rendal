'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from './AppContext';
import { Car, User, Globe, Menu, X, Shield, Calendar, PlusCircle, LogOut } from 'lucide-react';

export function Navbar() {
  const { locale, setLocale, t, user, openAuthModal, logout } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleLanguage = () => {
    setLocale(locale === 'en' ? 'ml' : 'en');
  };

  const isOwner = user?.roles.includes('OWNER') || user?.roles.includes('RENTAL_BUSINESS_OWNER');
  const isAdmin = user?.roles.includes('ADMIN') || user?.roles.includes('SUPER_ADMIN');

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Kerala Brand */}
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md group-hover:bg-emerald-700 transition">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <span className="text-lg font-black tracking-tight text-gray-900 flex items-center gap-1.5">
                  KERALA<span className="text-emerald-600">DRIVE</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 tracking-normal">KL</span>
                </span>
                <span className="block text-[10px] text-gray-500 font-medium">Rental Marketplace</span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
            <Link href="/rent" className="hover:text-emerald-600 transition">
              {t('search_vehicles')}
            </Link>

            {user && (
              <Link href="/customer" className="hover:text-emerald-600 transition flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-emerald-600" />
                {t('customer_dashboard')}
              </Link>
            )}

            {isOwner && (
              <Link href="/owner" className="hover:text-emerald-600 transition flex items-center gap-1.5">
                <PlusCircle className="w-4 h-4 text-emerald-600" />
                {t('owner_dashboard')}
              </Link>
            )}

            {isAdmin && (
              <Link href="/admin" className="hover:text-purple-600 transition flex items-center gap-1.5 text-purple-700 font-semibold">
                <Shield className="w-4 h-4" />
                {t('admin_dashboard')}
              </Link>
            )}

            <Link href="/privacy" className="hover:text-gray-900 transition text-xs text-gray-500">
              {t('privacy_center')}
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              title="Toggle Language"
            >
              <Globe className="w-3.5 h-3.5 text-gray-500" />
              <span>{locale === 'en' ? 'മലയാളം' : 'English'}</span>
            </button>

            {user ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    {user.displayName.charAt(0)}
                  </div>
                  <div className="text-left text-xs">
                    <p className="font-semibold text-gray-900 leading-tight">{user.displayName}</p>
                    <p className="text-[10px] text-emerald-700 capitalize">{user.primaryRole.toLowerCase()}</p>
                  </div>
                </div>

                <button
                  onClick={logout}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition"
              >
                <User className="w-4 h-4" />
                <span>{t('login')}</span>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleLanguage}
              className="p-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-700"
            >
              {locale === 'en' ? 'മല' : 'EN'}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 pt-3 pb-6 space-y-3">
          <Link
            href="/rent"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-semibold text-gray-800"
          >
            {t('search_vehicles')}
          </Link>

          {user && (
            <Link
              href="/customer"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-emerald-700"
            >
              {t('customer_dashboard')}
            </Link>
          )}

          {isOwner && (
            <Link
              href="/owner"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-emerald-700"
            >
              {t('owner_dashboard')}
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-2 text-sm font-semibold text-purple-700"
            >
              {t('admin_dashboard')}
            </Link>
          )}

          <Link
            href="/privacy"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-xs text-gray-500"
          >
            {t('privacy_center')}
          </Link>

          <div className="pt-3 border-t border-gray-100">
            {user ? (
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-900">{user.displayName}</p>
                  <p className="text-[11px] text-gray-500">{user.phone}</p>
                </div>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 font-semibold border border-red-200 rounded-lg"
                >
                  {t('logout')}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuthModal();
                }}
                className="w-full py-2.5 bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow"
              >
                {t('login')}
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
