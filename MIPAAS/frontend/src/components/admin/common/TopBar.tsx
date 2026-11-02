import React, { useState, useEffect } from 'react';
import { useMultiLevelAdmin } from '@/context/MultiLevelAdminContext';
import { BUILT_IN_ROLES } from '@/utils/multiLevelRbacDefaults';
import {
  Bell,
  Building,
  Check,
  ChevronDown,
  Globe,
  Key,
  Languages,
  LogOut,
  MapPin,
  Moon,
  Search,
  Shield,
  ShieldAlert,
  Sun,
  User,
  Zap,
} from 'lucide-react';

export default function TopBar() {
  const {
    session,
    activeRole,
    organisations,
    activeOrg,
    activeSite,
    statAlerts,
    language,
    setLanguage,
    theme,
    setTheme,
    switchOrganisation,
    switchSite,
    simulateRole,
    requestBreakGlass,
    sidebarCollapsed,
    setSidebarCollapsed,
    setMobileDrawerOpen,
  } = useMultiLevelAdmin();

  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [breakGlassModalOpen, setBreakGlassModalOpen] = useState(false);

  // Keyboard shortcut Ctrl+K / Cmd+K for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isPlatformStaff = session.level === 'level_0_platform';
  const statCount = statAlerts.length;

  return (
    <>
      <header
        className="h-16 w-full border-b border-white/10 flex items-center justify-between px-4 sm:px-6 z-30 select-none relative"
        style={{
          backgroundColor: '#0A1823',
        }}
      >
        {/* Left: Mobile hamburger & Organization/Site Switchers */}
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:text-white"
            title="Open navigation menu"
          >
            <div className="w-5 h-4 flex flex-col justify-between">
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
              <span className="w-full h-0.5 bg-current rounded" />
            </div>
          </button>

          {/* Organisation Switcher (Platform Staff Only or Display Tenant Name) */}
          {isPlatformStaff ? (
            <div className="relative">
              <button
                onClick={() => {
                  setOrgDropdownOpen(!orgDropdownOpen);
                  setSiteDropdownOpen(false);
                  setRoleDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all duration-150"
                title="Switch Target Healthcare Network (Platform Staff Feature)"
              >
                <Building className="w-3.5 h-3.5 text-[#00DCCE]" />
                <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
                  {activeOrg.name}
                </span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {orgDropdownOpen && (
                <div
                  className="absolute left-0 mt-2 w-72 rounded-2xl border border-white/15 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                  style={{ backgroundColor: '#0E273A' }}
                >
                  <div className="px-3 py-2 text-[11px] font-semibold text-[#A6B3BD] uppercase tracking-wider border-b border-white/10 mb-1">
                    Select Hospital Network / Lab Chain
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {organisations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          switchOrganisation(org.id);
                          setOrgDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                          org.id === activeOrg.id
                            ? 'bg-[#008280]/20 text-[#73C8BF] font-semibold border border-[#008280]/40'
                            : 'text-gray-300 hover:bg-white/5'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-medium text-white">{org.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            {org.code} · {org.sites.length} Sites · {org.tier}
                          </div>
                        </div>
                        {org.id === activeOrg.id && <Check className="w-3.5 h-3.5 text-[#00DCCE]" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white">
              <Building className="w-3.5 h-3.5 text-[#7C5CFC]" />
              <span className="font-semibold">{activeOrg.name}</span>
            </div>
          )}

          {/* Site Switcher */}
          <div className="relative">
            <button
              onClick={() => {
                setSiteDropdownOpen(!siteDropdownOpen);
                setOrgDropdownOpen(false);
                setRoleDropdownOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-gray-300 transition-all duration-150"
              title="Switch Specific Hospital Site / Lab Center"
            >
              <MapPin className="w-3.5 h-3.5 text-[#F5A623]" />
              <span className="truncate max-w-[120px] sm:max-w-[180px] text-white">
                {activeSite.name}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {siteDropdownOpen && (
              <div
                className="absolute left-0 mt-2 w-72 rounded-2xl border border-white/15 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backgroundColor: '#0E273A' }}
              >
                <div className="px-3 py-2 text-[11px] font-semibold text-[#A6B3BD] uppercase tracking-wider border-b border-white/10 mb-1">
                  Active Sites ({activeOrg.name})
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {activeOrg.sites.map((site) => (
                    <button
                      key={site.id}
                      onClick={() => {
                        switchSite(site.id);
                        setSiteDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs transition-colors ${
                        site.id === activeSite.id
                          ? 'bg-[#F5A623]/20 text-[#F5A623] font-semibold border border-[#F5A623]/40'
                          : 'text-gray-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="truncate">
                        <div className="font-medium text-white">{site.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {site.city} · AE: {site.pacsAeTitle} · Today: {site.activeCasesToday}
                        </div>
                      </div>
                      {site.id === activeSite.id && <Check className="w-3.5 h-3.5 text-[#F5A623]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="hidden lg:flex items-center flex-1 max-w-md mx-6">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-400 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <span>Search modules, users, synthetic cases (P-0001), models...</span>
            </div>
            <kbd className="px-1.5 py-0.5 rounded bg-black/40 border border-white/15 text-[10px] font-mono text-gray-300">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Actions: Role Simulator, STAT Bell, Language, Theme, Profile */}
        <div className="flex items-center gap-2.5">
          {/* Quick Role Simulator (Crucial for testing all 15 roles) */}
          <div className="relative hidden sm:block">
            <button
              onClick={() => {
                setRoleDropdownOpen(!roleDropdownOpen);
                setOrgDropdownOpen(false);
                setSiteDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500/20 to-violet-500/20 border border-teal-500/40 text-xs font-semibold text-teal-300 hover:scale-[1.02] transition-all"
              title="Test UI as different Roles across Levels 0, 1, 2, 3"
            >
              <Zap className="w-3.5 h-3.5 text-yellow-400" />
              <span>Simulate: {activeRole.name}</span>
              <ChevronDown className="w-3 h-3 text-teal-400" />
            </button>

            {roleDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-2xl border border-white/15 p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-96 overflow-y-auto"
                style={{ backgroundColor: '#0E273A' }}
              >
                <div className="px-3 py-2 text-[11px] font-bold text-teal-400 uppercase tracking-wider border-b border-white/10 mb-2">
                  ⚡ Simulate User Role & Level
                </div>

                {['level_0_platform', 'level_1_organisation', 'level_2_site', 'level_3_user'].map((lvl) => {
                  const rolesInLvl = BUILT_IN_ROLES.filter((r) => r.level === lvl);
                  const label = rolesInLvl[0]?.levelLabel || lvl;

                  return (
                    <div key={lvl} className="mb-2">
                      <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                        {label}
                      </div>
                      <div className="space-y-0.5">
                        {rolesInLvl.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => {
                              simulateRole(r.id);
                              setRoleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-left text-xs transition-colors ${
                              r.id === activeRole.id
                                ? 'bg-teal-500/20 text-teal-200 font-bold border border-teal-500/40'
                                : 'text-gray-300 hover:bg-white/5'
                            }`}
                          >
                            <span>{r.name}</span>
                            {r.id === activeRole.id && <Check className="w-3.5 h-3.5 text-teal-400" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STAT Urgent Alert Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
              title="STAT Urgent Notifications"
            >
              <Bell className="w-4 h-4" />
              {statCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 rounded-full text-[10px] font-extrabold text-white animate-pulse"
                  style={{
                    backgroundColor: '#FF7869',
                    boxShadow: '0 0 10px rgba(255, 120, 105, 0.6)',
                  }}
                >
                  {statCount}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <div
                className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-white/15 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backgroundColor: '#0E273A' }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                    <ShieldAlert className="w-4 h-4 text-[#FF7869]" />
                    <span>STAT Emergency Case Triage</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-500/40">
                    {statCount} Awaiting Review
                  </span>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {statAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-2.5 rounded-xl border border-red-500/30 bg-red-950/20 text-xs"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-white">{alert.patientSyntheticId}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500 text-white">
                          {alert.urgency}
                        </span>
                      </div>
                      <div className="text-gray-200 font-medium mb-1">{alert.finding}</div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400">
                        <span>{alert.siteName}</span>
                        <span className="text-amber-400 font-mono">
                          {alert.elapsedMinutes}m / {alert.slaLimitMinutes}m SLA
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Language Toggle: EN / हिंदी */}
          <button
            onClick={() => setLanguage(language === 'EN' ? 'HI' : 'EN')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 transition-colors"
            title="Toggle Language (English / हिंदी)"
          >
            <Languages className="w-3.5 h-3.5 text-teal-400" />
            <span>{language === 'EN' ? 'EN' : 'हिंदी'}</span>
          </button>

          {/* Theme Toggle (Dark / Light) */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-colors"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-yellow-300" /> : <Moon className="w-3.5 h-3.5" />}
          </button>

          {/* User Profile Menu with Session & MFA status */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-blue-600 flex items-center justify-center font-bold text-white text-xs">
                {session.name.charAt(0)}
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {profileOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/15 p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100"
                style={{ backgroundColor: '#0E273A' }}
              >
                <div className="pb-2.5 border-b border-white/10 mb-2">
                  <div className="font-semibold text-white text-sm">{session.name}</div>
                  <div className="text-xs text-gray-400">{session.email}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-teal-300 font-medium">
                    <Shield className="w-3 h-3 text-teal-400" />
                    <span>{activeRole.name}</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-gray-300 mb-3">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">MFA Status:</span>
                    <span className="text-emerald-400 font-bold">TOTP Authenticator Active</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Session Lease:</span>
                    <span className="font-mono text-gray-200">15m Token / 7d Refresh</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Session IP:</span>
                    <span className="font-mono text-gray-400">103.21.244.18 (IN)</span>
                  </div>
                </div>

                {/* Emergency Break Glass Request button for staff */}
                <button
                  onClick={() => {
                    setBreakGlassModalOpen(true);
                    setProfileOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/50 border border-red-500/40 transition-colors mb-2"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                  <span>Request Emergency Break-Glass</span>
                </button>

                <div className="border-t border-white/10 pt-2">
                  <a
                    href="/"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign out of MIPaaS</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Dialog Modal (Ctrl+K) */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            className="w-full max-w-xl rounded-2xl border border-white/20 p-4 shadow-2xl"
            style={{ backgroundColor: '#0E273A' }}
          >
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-3">
              <Search className="w-4 h-4 text-teal-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type a command, module name, patient token (P-0001)..."
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5"
              >
                ESC
              </button>
            </div>

            <div className="text-xs text-gray-400 space-y-1 max-h-64 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase">Quick Actions</div>
              <button
                onClick={() => {
                  simulateRole('role_platform_owner');
                  setSearchOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-gray-200 flex items-center justify-between"
              >
                <span>Switch to Platform Owner Role</span>
                <span className="text-[10px] text-teal-400 font-mono">Level 0</span>
              </button>
              <button
                onClick={() => {
                  simulateRole('role_org_dpo');
                  setSearchOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-gray-200 flex items-center justify-between"
              >
                <span>Switch to Compliance Officer (DPO)</span>
                <span className="text-[10px] text-teal-400 font-mono">Level 1 · DPDP Act</span>
              </button>
              <button
                onClick={() => {
                  simulateRole('role_clinician');
                  setSearchOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-gray-200 flex items-center justify-between"
              >
                <span>Switch to Clinician / Radiologist</span>
                <span className="text-[10px] text-teal-400 font-mono">Level 3</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Break-Glass Emergency Elevation Modal */}
      {breakGlassModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg rounded-3xl border border-red-500/40 p-6 shadow-2xl text-white"
            style={{ backgroundColor: '#0A1823' }}
          >
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="p-2 rounded-xl bg-red-950/60 border border-red-500/40">
                <ShieldAlert className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Emergency Break-Glass Activation</h3>
                <p className="text-xs text-gray-400">Strictly audited by Compliance & Security Governance</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed mb-4">
              Break-glass elevation bypasses standard tenant boundaries and grants temporary superuser
              privileges. An immutable incident audit log is recorded, and notifications will be dispatched
              to the Organisation DPO and Security Operations.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.target as HTMLFormElement;
                const reason = (form.elements.namedItem('reason') as HTMLInputElement).value;
                const ticket = (form.elements.namedItem('ticket') as HTMLInputElement).value;
                requestBreakGlass(reason, 60, ticket);
                setBreakGlassModalOpen(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Incident / JIRA Ticket Number *
                </label>
                <input
                  required
                  name="ticket"
                  placeholder="INC-2026-9921"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">
                  Clinical / Operational Justification *
                </label>
                <textarea
                  required
                  name="reason"
                  rows={3}
                  placeholder="e.g. Critical C-ECHO failure preventing STAT trauma study triage..."
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setBreakGlassModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Activate 60-Minute Elevation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
