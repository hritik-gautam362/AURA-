/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { NavigationTab } from '../types';
import {
  Home,
  Calendar as CalendarIcon,
  PlusCircle,
  History,
  Sparkles,
  Settings,
  Heart,
  Lock,
  WifiOff,
} from 'lucide-react';

interface NavigationProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  onOpenLogPeriod: () => void;
  onLock?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  onOpenLogPeriod,
  onLock,
}) => {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Mobile Top Bar Header with Brand, Offline Status, Quick Log, and Lock Button */}
      <header
        id="mobile-top-header"
        className="md:hidden sticky top-0 z-40 bg-[#FFF8FA]/95 backdrop-blur-md border-b border-[#F5E6E8] pt-[max(0.5rem,env(safe-area-inset-top,0px))] px-3.5 pb-2.5 flex items-center justify-between"
      >
        <div
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2 cursor-pointer select-none active:opacity-80 transition-opacity"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('home'); }}
          aria-label="Aura Cycle Home"
        >
          <div className="w-8 h-8 rounded-xl bg-[#8B0000] text-white flex items-center justify-center shadow-xs">
            <Heart className="w-4 h-4 fill-white" />
          </div>
          <div>
            <span className="text-base font-bold text-[#8B0000] tracking-tight font-serif">
              Aura
            </span>
            <span className="text-[10px] text-[#795B62] block font-medium -mt-1">
              Cycle & Wellness
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isOnline && (
            <div
              id="mobile-offline-badge"
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FFF0F2] border border-[#FFCDD2] text-[#B71C1C] text-[10px] font-semibold"
            >
              <WifiOff className="w-3 h-3" />
              <span className="hidden xs:inline">Offline</span>
            </div>
          )}

          {/* Mobile Quick Log Action */}
          <button
            id="mobile-header-quick-log-btn"
            onClick={onOpenLogPeriod}
            aria-label="Log Period Entry"
            title="Log Period Entry"
            className="min-h-[44px] px-3 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] btn-press shadow-2xs flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Log</span>
          </button>

          {onLock && (
            <button
              id="mobile-lock-vault-btn"
              onClick={onLock}
              aria-label="Lock Vault"
              title="Lock Vault"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#F3E5E8] bg-white text-[#8B0000] hover:bg-[#FFF0F4] btn-press shadow-2xs"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Desktop Top Bar Header (Unchanged) */}
      <header
        id="desktop-header-navigation"
        className="hidden md:block sticky top-0 z-40 bg-[#FFF8FA]/90 backdrop-blur-md border-b border-[#F5E6E8]"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div
            onClick={() => onTabChange('home')}
            className="flex items-center gap-2.5 cursor-pointer select-none"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onTabChange('home'); }}
            aria-label="Aura Cycle Home"
          >
            <div className="w-9 h-9 rounded-2xl bg-[#8B0000] text-white flex items-center justify-center shadow-xs">
              <Heart className="w-5 h-5 fill-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[#8B0000] tracking-tight font-serif">
                  Aura
                </span>
                {!isOnline && (
                  <span
                    id="desktop-offline-badge"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF0F2] border border-[#FFCDD2] text-[#B71C1C] text-[10px] font-semibold"
                  >
                    <WifiOff className="w-3 h-3" />
                    Offline (Vault Ready)
                  </span>
                )}
              </div>
              <span className="text-xs text-[#795B62] block font-medium -mt-1">
                Cycle & Wellness
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="flex items-center gap-1" role="tablist" aria-label="Desktop primary navigation">
            {[
              { id: 'home' as const, label: 'Home', icon: Home },
              { id: 'calendar' as const, label: 'Calendar', icon: CalendarIcon },
              { id: 'history' as const, label: 'History', icon: History },
              { id: 'insights' as const, label: 'Insights', icon: Sparkles },
              { id: 'settings' as const, label: 'Settings', icon: Settings },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  id={`desktop-nav-${id}`}
                  onClick={() => onTabChange(id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-label={label}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all btn-press ${
                    isActive
                      ? 'bg-[#FCE4EC] text-[#8B0000] shadow-2xs'
                      : 'text-[#795B62] hover:bg-[#FFF0F4] hover:text-[#2B171B]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-[#8B0000]' : 'text-[#795B62]'
                    }`}
                  />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {onLock && (
              <button
                id="desktop-lock-vault-btn"
                onClick={onLock}
                title="Lock Vault"
                aria-label="Lock Vault"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#F3E5E8] bg-white text-[#795B62] hover:text-[#8B0000] hover:border-[#8B0000] text-xs font-semibold transition-all btn-press shadow-2xs min-h-[44px]"
              >
                <Lock className="w-4 h-4 text-[#8B0000]" />
                <span className="hidden lg:inline">Lock Vault</span>
              </button>
            )}

            {/* Quick Action Button */}
            <button
              id="desktop-quick-log-btn"
              onClick={onOpenLogPeriod}
              aria-label="Log Period"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8B0000] text-white text-xs font-semibold hover:bg-[#6D0000] transition-all btn-press shadow-xs min-h-[44px]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Log Period</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar: Exactly 5 items with active indicator, smooth transitions & safe area support */}
      <nav
        id="mobile-bottom-navigation"
        role="tablist"
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F5E6E8] px-2 pt-1 pb-[max(0.6rem,env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-lg"
      >
        {[
          { id: 'home' as const, label: 'Home', icon: Home },
          { id: 'calendar' as const, label: 'Calendar', icon: CalendarIcon },
          { id: 'history' as const, label: 'History', icon: History },
          { id: 'insights' as const, label: 'Insights', icon: Sparkles },
          { id: 'settings' as const, label: 'Settings', icon: Settings },
        ].map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              id={`mobile-nav-${id}`}
              onClick={() => onTabChange(id)}
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              className={`flex-1 min-w-0 min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-2xl relative transition-all duration-150 btn-press ${
                isActive
                  ? 'text-[#8B0000] font-bold bg-[#FFF0F4]/70'
                  : 'text-[#795B62] hover:text-[#2B171B]'
              }`}
            >
              {/* Active Indicator Bar at Top of Tab */}
              {isActive && (
                <span
                  className="absolute top-0.5 w-6 h-1 rounded-full bg-[#8B0000] transition-all duration-200"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`w-5 h-5 shrink-0 transition-transform duration-150 ${
                  isActive ? 'scale-110 text-[#8B0000]' : 'text-[#795B62]'
                }`}
              />
              <span className="text-[10px] leading-tight truncate text-center w-full mt-0.5">
                {label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};

