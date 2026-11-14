'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ActivityIcon, FileTextIcon, LayoutGridIcon, LogOutIcon, PillIcon, ScanLineIcon, UserIcon, UsersIcon } from 'lucide-react';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';
import { HomeLogoMark } from '@/components/home/HomeNav';
import AssistantDock from '@/components/patient/assistant/AssistantDock';
import NotificationBell, { useBadge } from '@/components/care/NotificationBell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cx } from './ui';

const NAV = [
  { href: '/patient', key: 'overview', icon: LayoutGridIcon, tab: true },
  { href: '/patient/log', key: 'log', icon: ActivityIcon, tab: true },
  { href: '/patient/medications', key: 'medications', icon: PillIcon, tab: true },
  { href: '/patient/xrays', key: 'xrays', icon: ScanLineIcon, tab: true },
  { href: '/patient/records', key: 'records', icon: FileTextIcon, tab: false },
  { href: '/patient/care', key: 'care', icon: UsersIcon, tab: true },
  { href: '/patient/profile', key: 'profile', icon: UserIcon, tab: false },
] as const;

/** The care section's strings live in their own namespace (lib/i18n/messages/extra.ts). */
const navLabel = (key: string) => (key === 'care' ? 'care.nav' : `patient.nav.${key}`);

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function PortalSidebar({
  isActive,
  messages,
  bell,
  onSignOut,
}: {
  isActive: (href: string) => boolean;
  messages: number;
  bell: React.ReactNode;
  onSignOut: () => void;
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5">
        <Link href="/" className="flex h-10 items-center gap-2 text-sidebar-foreground" aria-label="MIPAAS home">
          <HomeLogoMark className="size-[18px]" />
          <span className="text-lg font-medium tracking-tight">MIPAAS</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('patient.portalName')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label={t('patient.portalName')}>
              <SidebarMenu>
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      render={<Link href={item.href} onClick={() => setOpenMobile(false)} />}
                    >
                      <item.icon aria-hidden="true" />
                      <span>{t(navLabel(item.key))}</span>
                    </SidebarMenuButton>
                    {item.key === 'care' && messages > 0 && <SidebarMenuBadge>{messages}</SidebarMenuBadge>}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 p-3">
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="min-w-0 flex-1 [&_select]:w-full" />
          {bell}
        </div>
        {user && (
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent/60 p-2.5">
            <Avatar>
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t('common.signOut')} onClick={onSignOut} />}>
                <LogOutIcon aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>{t('common.signOut')}</TooltipContent>
            </Tooltip>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function PatientShell({ children }: { children: React.ReactNode }) {
  const { status, user, signOut } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname() || '/patient';
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (leaving) return;
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === 'authenticated' && user && user.home !== '/patient') router.replace(user.home);
  }, [status, user, pathname, router, leaving]);

  const ready = status === 'authenticated' && user?.home === '/patient';
  const { badge, refresh: refreshBadge } = useBadge(ready);
  const isActive = (href: string) => (href === '/patient' ? pathname === '/patient' : pathname.startsWith(href));

  async function onSignOut() {
    setLeaving(true);
    await signOut();
    router.replace('/');
  }

  return (
    <SidebarProvider className="home-root h-ambient">
      <a
        href="#patient-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        {t('patient.skip')}
      </a>

      <PortalSidebar
        isActive={isActive}
        messages={badge.messages}
        onSignOut={onSignOut}
        bell={ready ? <NotificationBell count={badge.notifications} onChanged={refreshBadge} placement="sidebar" /> : null}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar: menu (all sections), brand, language, alerts, profile. */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b bg-background/90 px-3 backdrop-blur-xl md:hidden">
          <div className="flex items-center gap-1">
            <SidebarTrigger size="icon" aria-label={t('patient.nav.menu')} />
            <Link href="/" className="flex items-center gap-2" aria-label="MIPAAS home">
              <HomeLogoMark className="size-[18px]" />
              <span className="text-[17px] font-medium tracking-tight">MIPAAS</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            {ready && <NotificationBell count={badge.notifications} onChanged={refreshBadge} placement="topbar" />}
            <Link href="/patient/profile" aria-label={t('patient.nav.profile')} className="rounded-full">
              <Avatar>
                <AvatarFallback>{user ? initials(user.name) : ''}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main id="patient-main" className="pb-32 md:pb-28">
          <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 sm:px-8 md:pt-10">
            {ready ? (
              children
            ) : (
              <div aria-busy="true" className="flex flex-col gap-4">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="h-48" />
              </div>
            )}
          </div>
        </main>
      </div>

      {ready && <AssistantDock />}

      {/* Phone tab bar: five destinations; Records and Profile are in the menu. */}
      <nav
        aria-label={t('patient.portalName')}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-xl md:hidden"
      >
        {NAV.filter((n) => n.tab).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {active && <span aria-hidden="true" className="absolute -top-1.5 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-ring" />}
              <span className="relative">
                <item.icon aria-hidden="true" className="size-5" />
                {item.key === 'care' && badge.messages > 0 && <span aria-hidden="true" className="absolute -top-1 -right-1.5 size-2 rounded-full bg-destructive" />}
              </span>
              <span className="w-full truncate text-center">{t(navLabel(item.key))}</span>
            </Link>
          );
        })}
      </nav>
    </SidebarProvider>
  );
}
