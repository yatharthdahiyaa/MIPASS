import React from 'react';
import { PermissionScope } from '@/types/multiLevelRbac';
import { Globe, Building2, MapPin, User } from 'lucide-react';

interface ScopeBadgeProps {
  scope: PermissionScope;
  size?: 'sm' | 'md';
  showIcon?: boolean;
}

export default function ScopeBadge({ scope, size = 'sm', showIcon = true }: ScopeBadgeProps) {
  const config = {
    platform: {
      label: 'Platform',
      bg: 'rgba(0, 220, 206, 0.12)',
      border: 'rgba(0, 220, 206, 0.3)',
      text: '#00DCCE',
      icon: Globe,
    },
    organisation: {
      label: 'Organisation',
      bg: 'rgba(124, 92, 252, 0.12)',
      border: 'rgba(124, 92, 252, 0.3)',
      text: '#98AED9',
      icon: Building2,
    },
    site: {
      label: 'Site',
      bg: 'rgba(245, 166, 35, 0.12)',
      border: 'rgba(245, 166, 35, 0.3)',
      text: '#F5A623',
      icon: MapPin,
    },
    own: {
      label: 'Own',
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.18)',
      text: '#D9DBDD',
      icon: User,
    },
  }[scope];

  const Icon = config.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide ${padding}`}
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        borderWidth: 1,
        color: config.text,
      }}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{config.label}</span>
    </span>
  );
}
