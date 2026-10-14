import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'orange' | 'blue' | 'green' | 'red' | 'gray' | 'purple';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  const variantStyles = {
    orange: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700/50',
    blue: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-700/50',
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700/50',
    red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-700/50',
    purple: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-700/50',
    gray: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded font-semibold border ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {children}
    </span>
  );
}
