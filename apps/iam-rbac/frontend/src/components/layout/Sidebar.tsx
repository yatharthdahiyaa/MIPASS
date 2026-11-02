import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  FileCode,
  UsersRound,
  History,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar() {
  const { can, user } = useAuth();

  const navItems = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      permission: null, // Always visible
    },
    {
      section: 'Access Management',
      items: [
        {
          title: 'User groups',
          path: '/iam/groups',
          icon: UsersRound,
          permission: 'groups:read',
        },
        {
          title: 'Users',
          path: '/iam/users',
          icon: Users,
          permission: 'users:read',
        },
        {
          title: 'Roles',
          path: '/iam/roles',
          icon: ShieldAlert,
          permission: 'roles:read',
        },
        {
          title: 'Policies',
          path: '/iam/policies',
          icon: FileCode,
          permission: 'policies:read',
        },
      ],
    },
    {
      section: 'Access Reports & Audit',
      items: [
        {
          title: 'Sign-in & Audit logs',
          path: '/iam/audit',
          icon: History,
          permission: 'audit:read',
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-white dark:bg-aws-navydark border-r border-gray-200 dark:border-aws-darkBorder flex flex-col justify-between select-none">
      <div className="py-4">
        {/* Header */}
        <div className="px-5 pb-4 mb-2 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            IAM Dashboard
          </h2>
        </div>

        {/* Navigation */}
        <nav className="space-y-6 px-3">
          {/* Main Dashboard Link */}
          <div>
            <NavLink
              to="/dashboard"
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-aws-orange text-black font-bold shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Dashboard Overview</span>
            </NavLink>
          </div>

          {/* Grouped Sections */}
          {navItems.slice(1).map((sectionGroup: any, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {sectionGroup.section}
              </div>

              {sectionGroup.items.map((item: any) => {
                const isAllowed = item.permission ? can(item.permission) : true;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-aws-orange/15 text-aws-orangeHover dark:text-aws-orange font-bold border-l-4 border-aws-orange'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      } ${!isAllowed ? 'opacity-50' : ''}`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </div>

                    {!isAllowed && (
                      <span title="Permission restricted" className="text-gray-400">
                        <Lock className="w-3 h-3" />
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Info Box */}
      <div className="p-4 border-t border-gray-100 dark:border-gray-800 text-[11px] text-gray-400">
        <div>Role: <strong className="text-gray-700 dark:text-gray-300">{user?.roles[0] || 'User'}</strong></div>
        <div className="truncate">Org: {user?.accountName}</div>
      </div>
    </aside>
  );
}
