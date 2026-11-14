'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ArrowRightIcon, CheckIcon, CircleAlertIcon, DownloadIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { cx } from '@/components/home/ui';
import { AuthApiError } from '@/lib/auth/api';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button as UIButton } from '@/components/ui/button';
import { Card as UICard, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty as UIEmpty, EmptyContent, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { NativeSelect } from '@/components/ui/native-select';
import { Skeleton as UISkeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs as UITabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { toast } from '@/components/ui/toast';

export { cx };

/* ------------------------------------------------------------------ data */

/** Loads data on mount and on `reload()`; keeps the previous data while refreshing. */
export function useLoader<T>(load: () => Promise<T>, deps: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadRef.current());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and dependency changes; late responses from superseded requests are ignored.
  useEffect(() => {
    let cancelled = false;
    loadRef.current().then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
        setLoading(false);
      },
      (err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Turns an API error into a message in the current language where we can. */
export function useErrorText() {
  const { t } = useI18n();
  return (err: unknown) => {
    if (err instanceof AuthApiError) return err.status === 0 ? t('common.offline') : err.message;
    return t('common.error');
  };
}

/* ---------------------------------------------------------------- format */

export function useFormat() {
  const { intl, t } = useI18n();
  return {
    num: (v: number, digits = 0) => new Intl.NumberFormat(intl, { maximumFractionDigits: digits }).format(v),
    pct: (v: number) => new Intl.NumberFormat(intl, { style: 'percent', maximumFractionDigits: 0 }).format(v),
    date: (iso: string, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
      new Intl.DateTimeFormat(intl, opts).format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso)),
    time: (iso: string) => new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' }).format(new Date(iso)),
    slot: (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return new Intl.DateTimeFormat(intl, { hour: 'numeric', minute: '2-digit' }).format(d);
    },
    /** "Today" / "Yesterday" / "3 days ago" / a date. */
    relDay: (isoDate: string) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(`${isoDate.slice(0, 10)}T00:00:00`);
      const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
      if (diff <= 0) return t('common.today');
      if (diff === 1) return t('common.yesterday');
      if (diff < 7) return t('common.daysAgo', { n: diff });
      return new Intl.DateTimeFormat(intl, { dateStyle: 'medium' }).format(d);
    },
    bytes: (n: number) =>
      n < 1024 * 1024
        ? `${new Intl.NumberFormat(intl, { maximumFractionDigits: 0 }).format(n / 1024)} KB`
        : `${new Intl.NumberFormat(intl, { maximumFractionDigits: 1 }).format(n / 1024 / 1024)} MB`,
  };
}

/* ----------------------------------------------------------------
   Product-screen building blocks, composed from components/ui (shadcn).
   ---------------------------------------------------------------- */

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h1>
        {subtitle && <p className="max-w-2xl text-base text-pretty text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

/** A card with an optional heading row; the heading is a real h2 for screen-reader navigation. */
export function Card({
  title,
  action,
  className,
  children,
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <UICard className={className}>
      {(title || action) && (
        <CardHeader>
          {title && (
            <CardTitle>
              <h2>{title}</h2>
            </CardTitle>
          )}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent>{children}</CardContent>
    </UICard>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <UIEmpty className="border">
      <EmptyHeader>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </UIEmpty>
  );
}

export const Skeleton = UISkeleton;

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const text = useErrorText();
  const { t } = useI18n();
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{text(error)}</AlertDescription>
      {onRetry && (
        <AlertAction>
          <UIButton size="sm" variant="outline" onClick={onRetry}>
            {t('common.retry')}
          </UIButton>
        </AlertAction>
      )}
    </Alert>
  );
}

/* ---------------------------------------------------------------- buttons */

type BtnProps = React.ComponentProps<typeof UIButton> & { tone?: 'light' | 'ghost' | 'danger'; pending?: boolean };

/** shadcn Button with the old tone names (light → default, ghost → outline, danger → destructive) and a pending spinner. */
export function Button({ tone = 'light', pending, disabled, children, ...rest }: BtnProps) {
  const variant = tone === 'ghost' ? 'outline' : tone === 'danger' ? 'destructive' : 'default';
  return (
    <UIButton variant={variant} disabled={disabled || pending} aria-busy={pending || undefined} {...rest}>
      {pending && <Spinner data-icon="inline-start" />}
      {children}
    </UIButton>
  );
}

export function IconButton({ label, children, ...rest }: React.ComponentProps<typeof UIButton> & { label: string }) {
  return (
    <UIButton variant="ghost" size="icon" aria-label={label} title={label} {...rest}>
      {children}
    </UIButton>
  );
}

/** A button that asks for confirmation (shadcn AlertDialog) before running a consequential action. */
export function ConfirmAction({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = 'destructive',
  className,
}: {
  label: string;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  variant?: 'destructive' | 'outline' | 'ghost';
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={<UIButton variant={variant} className={className} />}>{label}</AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {confirmLabel ?? label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Trash icon button that asks before deleting (shadcn AlertDialog instead of window.confirm). */
export function ConfirmDelete({
  label,
  title,
  description,
  onConfirm,
  withText,
}: {
  label: string;
  title: string;
  description?: string;
  onConfirm: () => Promise<void> | void;
  /** Show the label next to the icon (a destructive text button) instead of an icon-only button. */
  withText?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={withText ? <UIButton variant="destructive" /> : <UIButton variant="ghost" size="icon" aria-label={label} title={label} />}
      >
        <Trash2Icon data-icon={withText ? 'inline-start' : undefined} aria-hidden="true" />
        {withText && label}
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner data-icon="inline-start" />}
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* ---------------------------------------------------------------- inputs */

function LabelRow({ htmlFor, label, hint }: { htmlFor: string; label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return <LabelRow htmlFor={htmlFor} label={children} hint={hint} />;
}

export function TextInput({
  label,
  hint,
  suffix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: React.ReactNode; suffix?: string }) {
  const id = useId();
  return (
    <Field className={cx('gap-2', className)}>
      <LabelRow htmlFor={id} label={label} hint={hint} />
      {suffix ? (
        <InputGroup>
          <InputGroupInput id={id} {...props} />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{suffix}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      ) : (
        <Input id={id} {...props} />
      )}
    </Field>
  );
}

export function SelectInput({
  label,
  hint,
  className,
  children,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> & { label: string; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <Field className={cx('gap-2', className)}>
      <LabelRow htmlFor={id} label={label} hint={hint} />
      <NativeSelect id={id} className="w-full" {...props}>
        {children}
      </NativeSelect>
    </Field>
  );
}

export function TextArea({ label, hint, className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: React.ReactNode }) {
  const id = useId();
  return (
    <Field className={cx('gap-2', className)}>
      <LabelRow htmlFor={id} label={label} hint={hint} />
      <Textarea id={id} className="min-h-24" {...props} />
    </Field>
  );
}

/** Pressable chip for multi-select choices (symptoms, sharing scopes). Shows a tick when on. */
export function Chip({
  active,
  children,
  className,
  onClick,
  disabled,
}: {
  active: boolean;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <Toggle variant="outline" size="sm" pressed={active} onClick={onClick} disabled={disabled} className={className}>
      {active && <CheckIcon data-icon="inline-start" />}
      {children}
    </Toggle>
  );
}

/* ----------------------------------------------------------------- tabs */

/** Section tabs (the panels are rendered by the caller). */
export function Tabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
}: {
  label: string;
  tabs: { key: T; label: string; badge?: number }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <UITabs value={value} onValueChange={(v) => onChange(v as T)}>
      <TabsList aria-label={label} className="max-w-full overflow-x-auto">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.key} value={tab.key}>
            {tab.label}
            {tab.badge ? <Badge>{tab.badge}</Badge> : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </UITabs>
  );
}

/* ---------------------------------------------------------------- toast */

/** Short confirmations through the app-wide shadcn toaster. `node` stays for existing callers. */
export function useToast() {
  const show = useCallback((m: string) => {
    toast.add({ title: m });
  }, []);
  return { show, node: null as React.ReactNode };
}

/* ---------------------------------------------------------------- icons */

export const Icon = {
  plus: <PlusIcon aria-hidden="true" className="size-4" />,
  trash: <Trash2Icon aria-hidden="true" className="size-4" />,
  check: <CheckIcon aria-hidden="true" className="size-4" />,
  download: <DownloadIcon aria-hidden="true" className="size-4" />,
  arrow: <ArrowRightIcon aria-hidden="true" className="size-3.5" />,
};
