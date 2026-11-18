'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ActivityIcon, FileTextIcon, LayoutGridIcon, LogOutIcon, MessageCircleIcon, PillIcon, ScanLineIcon, UserIcon, UsersIcon } from 'lucide-react';
import { useSession } from '@/lib/auth/SessionProvider';
import { useI18n } from '@/lib/i18n/I18nProvider';
import LanguageSwitcher from '@/lib/i18n/LanguageSwitcher';
import { HomeLogoMark } from '@/components/home/HomeNav';
import AssistantDock, { ASSISTANT_PANEL_ID } from '@/components/patient/assistant/AssistantDock';
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
      <SidebarHeader className="px-5 pt-6 pb-3">
        <Link href="/" className="flex h-10 w-fit items-center gap-2 rounded-control text-sidebar-foreground" aria-label="MIPAAS home">
          <HomeLogoMark className="size-[18px]" />
          <span className="text-[17px] font-semibold tracking-[-0.02em]">MIPAAS</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/80 uppercase">{t('patient.portalName')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav aria-label={t('patient.portalName')}>
              <SidebarMenu className="gap-1">
                {NAV.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive(item.href)}
                      aria-current={isActive(item.href) ? 'page' : undefined}
                      className="h-navitem h-10 gap-3 px-3"
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
      <SidebarFooter className="gap-2 p-3">
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="min-w-0 flex-1 [&_select]:w-full" />
          {bell}
        </div>
        {user && (
          <div className="mt-1 flex items-center gap-3 rounded-control border border-[var(--glass-border)] bg-white/[0.03] px-2.5 py-2 shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]">
            <Avatar>
              <AvatarFallback className="text-meta font-medium">{initials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-meta text-muted-foreground">{user.email}</span>
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
  const [assistantOpen, setAssistantOpen] = useState(false);

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
    <SidebarProvider className="home-root h-ambient print:bg-white">
      <a
        href="#patient-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
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
        {/* Phone top bar: menu (every section, language), brand, assistant, alerts, profile. */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-[var(--glass-border)] bg-[rgb(16_16_16/0.72)] px-2 backdrop-blur-xl md:hidden print:hidden">
          <div className="flex items-center gap-0.5">
            <SidebarTrigger className="size-10" aria-label={t('patient.nav.menu')} />
            <Link href="/" className="flex h-10 items-center gap-2 rounded-control px-1.5" aria-label="MIPAAS home">
              <HomeLogoMark className="size-[18px]" />
              <span className="text-[17px] font-semibold tracking-[-0.02em]">MIPAAS</span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {ready && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('patient.assistant.open')}
                aria-controls={ASSISTANT_PANEL_ID}
                aria-expanded={assistantOpen}
                onClick={() => setAssistantOpen(true)}
              >
                <MessageCircleIcon aria-hidden="true" />
              </Button>
            )}
            {ready && <NotificationBell count={badge.notifications} onChanged={refreshBadge} placement="topbar" />}
            <Link href="/patient/profile" aria-label={t('patient.nav.profile')} className="grid size-10 place-items-center rounded-full">
              <Avatar>
                <AvatarFallback className="text-meta font-medium">{user ? initials(user.name) : ''}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>

        <main id="patient-main" className="pb-28 print:pb-0">
          <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 sm:px-8 md:pt-10 print:max-w-none print:px-0 print:pt-0">
            {ready ? (
              children
            ) : (
              <div aria-busy="true" className="flex flex-col gap-4">
                <Skeleton className="h-10 w-1/2" />
                <Skeleton className="h-24" />
                <Skeleton className="h-64" />
              </div>
            )}
          </div>
        </main>
      </div>

      {ready && <AssistantDock open={assistantOpen} onOpenChange={setAssistantOpen} />}

      {/* Floating assistant launcher (tablet and desktop; phones use the top bar button). */}
      {ready && !assistantOpen && (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          aria-controls={ASSISTANT_PANEL_ID}
          aria-expanded={false}
          className="group h-key h-fab fixed right-6 bottom-6 z-40 hidden h-12 min-w-12 items-center justify-center rounded-full px-[15px] text-body font-medium md:inline-flex print:hidden"
        >
          <MessageCircleIcon aria-hidden="true" className="size-[18px] shrink-0" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover:ml-2 group-hover:max-w-[14rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[14rem] group-focus-visible:opacity-100">
            {t('patient.assistant.open')}
          </span>
        </button>
      )}

      {/* Phone tab bar: five destinations; Records and Profile are in the menu. */}
      <nav
        aria-label={t('patient.portalName')}
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--glass-border)] bg-[rgb(16_16_16/0.8)] px-1 pt-1.5 pb-[max(env(safe-area-inset-bottom),6px)] backdrop-blur-xl md:hidden print:hidden"
      >
        {NAV.filter((n) => n.tab).map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cx(
                'relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-control px-1 text-[11px] font-medium transition-colors',
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
