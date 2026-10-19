'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  FileText,
  MessageSquare,
  Search,
  Bell,
  HelpCircle,
  Plus,
  Filter,
  ChevronDown,
  Download,
  SlidersHorizontal,
  ArrowRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  MoreHorizontal,
  User,
  Heart,
  Stethoscope
} from 'lucide-react';
import MultiRoleAuthModal from '@/components/auth/MultiRoleAuthModal';
import { useRBAC } from '@/context/RBACContext';

export default function CareviaDashboardPreview() {
  const { currentUser } = useRBAC();
  const userName = currentUser?.name || 'Marian';
  const userEmail = currentUser?.email || 'marian@mipass.org';
  const userInitial = userName.charAt(0);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'health' | 'appointments' | 'reports' | 'messages'>('dashboard');
  const [timeFilter, setTimeFilter] = useState('Monthly');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <>
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-20 -mt-2 sm:mt-2 pb-16">
        {/* Floating Glassmorphic Container matching Reference Image */}
        <div className="rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/80 shadow-[0_30px_90px_rgba(30,58,138,0.18)] p-4 sm:p-7 text-slate-800 transition-all duration-300">
          
          {/* 1. Dashboard Top Header Bar */}
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pb-5 border-b border-slate-100">
            {/* Logo + Navigation Pills */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-6 w-full lg:w-auto">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center text-white shadow-sm">
                  <Activity className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="font-extrabold text-lg text-slate-900 tracking-tight">MIPASS</span>
              </div>

              {/* Sub-nav Pills */}
              <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-full text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'dashboard'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('health')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'health'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Health
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('appointments')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer hidden sm:inline-block ${
                    activeTab === 'appointments'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Appointments
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer hidden md:inline-block ${
                    activeTab === 'reports'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Reports
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('messages')}
                  className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer hidden md:inline-block ${
                    activeTab === 'messages'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Messages
                </button>
              </div>
            </div>

            {/* Search + Notifications + Profile */}
            <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search..."
                  aria-label="Search dashboard"
                  className="w-full pl-8 pr-3 py-1.5 rounded-full bg-slate-100/90 border border-slate-200/60 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors relative"
                aria-label="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 absolute top-2 right-2" />
              </button>

              <button
                type="button"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors hidden sm:flex"
                aria-label="Help & Documentation"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>

              {/* User Avatar & Name */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 ring-2 ring-white overflow-hidden flex items-center justify-center text-xs font-bold text-white shadow-xs">
                  <span>{userInitial}</span>
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-bold text-slate-800 leading-tight">{userName}</div>
                  <div className="text-[10px] text-slate-400 leading-tight">{userEmail}</div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Welcome Title & Controls Row */}
          <div className="pt-6 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back, {userName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-normal">
                Here&apos;s a quick overview of your health and upcoming activities.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-md shadow-blue-500/25 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>New Appointment</span>
              </button>
            </div>
          </div>

          {/* Sub-filter row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <Filter className="w-3 h-3 text-slate-500" />
                <span>Filter</span>
              </button>
              <button
                type="button"
                onClick={() => setTimeFilter(timeFilter === 'Monthly' ? 'Weekly' : 'Monthly')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1 font-medium transition-colors cursor-pointer"
              >
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{timeFilter}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>Download Summary</span>
              </button>
            </div>

            <button
              type="button"
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 flex items-center gap-1.5 font-medium transition-colors cursor-pointer ml-auto"
            >
              <SlidersHorizontal className="w-3 h-3 text-slate-500" />
              <span>Customize View</span>
            </button>
          </div>

          {/* 3. Main 4-Card Healthcare Metric Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Health Alerts */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all group">
              <div>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Health Alerts</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Some reports require your attention. Review them to stay on track with your treatment.
                </p>
                <div className="mt-4">
                  <Link
                    href="/emr"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <span>View Reports</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-200/60">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
                    Completed: 38
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />
                    Pending: 12
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                  <div
                    className="h-full bg-blue-600"
                    style={{
                      width: '76%',
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)'
                    }}
                  />
                  <div className="h-full bg-slate-300" style={{ width: '24%' }} />
                </div>
              </div>
            </div>

            {/* Card 2: Health Trend Bar Chart */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">Health Trend</h3>
                <button type="button" className="text-slate-400 hover:text-slate-600 text-xs cursor-pointer">
                  <span className="font-bold">—</span>
                </button>
              </div>

              {/* Bar Chart Graphics matching Reference */}
              <div className="my-3 flex items-end justify-between gap-2.5 h-36 px-2">
                {/* Thu */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-blue-600/80 rounded-t-xl h-16 hover:bg-blue-600 transition-all" />
                  <span className="text-[11px] font-medium text-slate-400">Thu</span>
                </div>
                {/* Fri */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-blue-600/80 rounded-t-xl h-22 hover:bg-blue-600 transition-all" />
                  <span className="text-[11px] font-medium text-slate-400">Fri</span>
                </div>
                {/* Sat (Peak 72%) */}
                <div className="flex flex-col items-center gap-1 flex-1 relative">
                  <span className="text-[10px] font-extrabold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md mb-0.5 animate-pulse">
                    72%
                  </span>
                  <div
                    className="w-full bg-blue-600 rounded-t-xl h-28 shadow-sm"
                    style={{
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.35) 4px, rgba(255,255,255,0.35) 8px)'
                    }}
                  />
                  <span className="text-[11px] font-bold text-blue-600">Sat</span>
                </div>
                {/* Sun */}
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-blue-600/80 rounded-t-xl h-24 hover:bg-blue-600 transition-all" />
                  <span className="text-[11px] font-medium text-slate-400">Sun</span>
                </div>
              </div>

              <div className="pt-2 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-200/60">
                <span>Weekly Adherence</span>
                <span className="font-bold text-emerald-600">+8.4% vs last week</span>
              </div>
            </div>

            {/* Card 3: Care Team Update (Vibrant Blue Signature Card) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#1d4ed8] text-white flex flex-col justify-between shadow-lg shadow-blue-600/20 hover:scale-[1.01] transition-transform">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-white">Care Team Update</h3>
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <Heart className="w-3 h-3 fill-white text-white" />
                  </div>
                </div>
                <p className="text-xs text-blue-50 mt-3 leading-relaxed font-normal">
                  Your recent checkup results are improving. Continue your current medication and follow up next week. Remember to maintain a balanced diet to support your health.
                </p>
              </div>

              <div className="mt-6 pt-3 border-t border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-7 h-1 rounded-full bg-white" />
                  <span className="w-3 h-1 rounded-full bg-white/40" />
                  <span className="w-3 h-1 rounded-full bg-white/40" />
                </div>
                <span className="text-[10px] text-blue-100 font-medium">Dr. Leslie M.</span>
              </div>
            </div>

            {/* Card 4: Recent Activity Timeline */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight">Recent Activity</h3>
                  <button type="button" className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Updates on your health and care.</p>

                {/* Timeline Items matching Reference */}
                <div className="mt-3.5 space-y-3 relative before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200">
                  {/* Item 1 */}
                  <div className="pl-4 relative flex items-start justify-between text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white absolute -left-[1px] top-1" />
                    <div>
                      <div className="font-semibold text-slate-800 text-[11px]">Blood test report uploaded</div>
                      <div className="text-[10px] text-slate-400">Uploaded by Metro Diagnostic Center</div>
                    </div>
                    <Link href="/emr" className="text-[11px] font-bold text-blue-600 hover:underline shrink-0 ml-1">
                      View
                    </Link>
                  </div>

                  {/* Item 2 */}
                  <div className="pl-4 relative flex items-start justify-between text-xs">
                    <span className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-white absolute -left-[1px] top-1" />
                    <div>
                      <div className="font-semibold text-slate-800 text-[11px]">New note from Dr. Leslie</div>
                      <div className="text-[10px] text-slate-400">Follow-up advice added to treatment plan</div>
                    </div>
                    <Link href="/emr" className="text-[11px] font-bold text-blue-600 hover:underline shrink-0 ml-1">
                      Read
                    </Link>
                  </div>

                  {/* Item 3 */}
                  <div className="pl-4 relative flex items-start justify-between text-xs">
                    <span className="w-2 h-2 rounded-full bg-slate-300 ring-2 ring-white absolute -left-[1px] top-1" />
                    <div>
                      <div className="font-semibold text-slate-800 text-[11px]">Appointment rescheduled</div>
                      <div className="text-[10px] text-slate-400">Consultation with Dr. Maria Chen</div>
                    </div>
                    <Link href="/emr" className="text-[11px] font-bold text-blue-600 hover:underline shrink-0 ml-1">
                      Details
                    </Link>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">3 updates today</span>
                <Link href="/emr" className="text-blue-600 font-bold hover:underline">
                  View all →
                </Link>
              </div>
            </div>
          </div>

          {/* 4. Bottom Row Preview Cards (Upcoming Checkups, Recovery, Care Team) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5 mt-5 border-t border-slate-100 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Upcoming Checkups</div>
                  <div className="text-[10px] text-slate-400">Cardiology Review · Nov 24, 10:00 AM</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">Confirmed</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Recovery Progress</div>
                  <div className="text-[10px] text-slate-400">Track recovery from doctor & reports</div>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">92% Target</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Care Team</div>
                  <div className="text-[10px] text-slate-400">Dr. Leslie, Dr. Maria, Dr. Vance</div>
                </div>
              </div>
              <Link href="/emr" className="text-[10px] font-bold text-blue-600 hover:underline">
                Message →
              </Link>
            </div>
          </div>

        </div>
      </div>

      {/* Multi-Role Authentication Modal */}
      <MultiRoleAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialRole="patient"
      />
    </>
  );
}
