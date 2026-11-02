import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Shield,
  Key,
  Copy,
  Check,
  Globe,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Badge } from '../common/Badge';

interface NavbarProps {
  onOpenMfaModal?: () => void;
}

export function Navbar({ onOpenMfaModal }: NavbarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyAccountId = () => {
    if (user?.accountId) {
      navigator.clipboard.writeText(user.accountId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getMipaasUrl = (path: string) => {
    if (!user) return `http://localhost:3000${path}`;
    try {
      const ssoPayload = btoa(encodeURIComponent(JSON.stringify(user)));
      return `http://localhost:3000${path}?sso_user=${ssoPayload}`;
    } catch {
      return `http://localhost:3000${path}`;
    }
  };

  return (
    <header className="bg-aws-navy text-white text-sm h-12 sticky top-0 z-40 flex items-center justify-between px-3 md:px-4 shadow-md select-none">
      {/* Left: AWS Logo & Console Brand */}
      <div className="flex items-center gap-3 md:gap-5 flex-shrink-0">
        <Link to="/dashboard" className="flex items-center gap-2 group">
          {/* AWS Cube Icon */}
          <div className="h-6 w-6 rounded bg-gradient-to-br from-aws-orange to-aws-orangeHover flex items-center justify-center font-black text-black text-xs shadow-sm group-hover:scale-105 transition-transform">
            M
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-white text-base tracking-tight leading-none">
              AWS
            </span>
            <span className="hidden sm:inline text-xs text-gray-300 font-medium">
              IAM Console
            </span>
          </div>
        </Link>
      </div>

      {/* Middle: Universal Search */}
      <div className="flex-1 max-w-xl mx-4 hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search IAM users, roles, policies [Alt+S]"
            className="w-full bg-[#131A22] border border-[#414750] focus:border-aws-orange text-xs text-white pl-9 pr-4 py-1.5 rounded transition-all focus:outline-none placeholder-gray-400"
          />
        </div>
      </div>

      {/* Right Tools & Account Switcher */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* MiPAAS Direct Link */}
        <a
          href={getMipaasUrl('/doctor')}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00DCCE]/15 border border-[#00DCCE]/30 text-[#00DCCE] hover:bg-[#00DCCE]/25 text-xs font-bold transition-all shadow-sm cursor-pointer"
          title="Open MiPAAS Clinical Workstation on port 3000"
        >
          <Activity className="w-3.5 h-3.5 text-[#00DCCE]" />
          <span>Launch MiPAAS</span>
        </a>

        {/* Region */}
        <div className="hidden lg:flex items-center gap-1 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/10 cursor-pointer">
          <Globe className="w-3.5 h-3.5 text-aws-orange" />
          <span>ap-south-1 (Mumbai)</span>
        </div>

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 text-gray-300 hover:text-white rounded hover:bg-white/10 transition-colors cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Account Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setAccountMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 px-2.5 py-1 rounded hover:bg-white/10 transition-colors text-xs font-semibold cursor-pointer"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-gray-300 font-mono text-[11px] hidden sm:inline">
                {user?.accountAlias || user?.accountId}
              </span>
              <span className="text-white font-bold">
                {user?.username}
              </span>
              {user?.isRoot ? (
                <Badge variant="orange" size="sm">Root</Badge>
              ) : (
                <Badge variant="blue" size="sm">{user?.roles[0] || 'User'}</Badge>
              )}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${accountMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Account Dropdown */}
          {accountMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-aws-darkCard border border-gray-200 dark:border-aws-darkBorder rounded-md shadow-2xl py-2 z-50 text-gray-800 dark:text-gray-200 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block mb-1">
                  Active Organization
                </span>
                <div className="text-sm font-bold text-gray-900 dark:text-white truncate">
                  {user?.accountName || 'AWS Organization'}
                </div>
                <div className="flex items-center justify-between text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
                  <span>ID: {user?.accountId}</span>
                  <button
                    type="button"
                    onClick={handleCopyAccountId}
                    className="text-aws-blue hover:text-aws-blueHover p-0.5 rounded cursor-pointer"
                    title="Copy Account ID"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700/60 text-xs">
                <div className="text-[11px] text-gray-400">Authenticated Identity</div>
                <div className="font-semibold text-gray-800 dark:text-gray-200 mt-0.5">
                  {user?.username} {user?.isRoot && '(Root Account Owner)'}
                </div>
                <div className="text-gray-400 text-[11px] truncate">{user?.email}</div>
              </div>

              <div className="p-1 space-y-0.5">
                <a
                  href={getMipaasUrl('/doctor')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded hover:bg-teal-50 dark:hover:bg-teal-950/30 text-teal-700 dark:text-teal-300 cursor-pointer font-semibold"
                >
                  <Activity className="w-4 h-4 text-[#00DCCE]" />
                  <span>Clinical Workstation (/doctor)</span>
                </a>

                <a
                  href={getMipaasUrl('/admin')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  <Globe className="w-4 h-4 text-aws-orange" />
                  <span>Lab Admin Hub (/admin)</span>
                </a>

                {onOpenMfaModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onOpenMfaModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-aws-orange" />
                    <span>Security &amp; MFA Setup</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 cursor-pointer transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign out of console</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
