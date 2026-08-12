"use client";

import Link from "next/link";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";

export function LoadingSkeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-[var(--radius-card)] ${className}`} />;
}

export function RowSkeleton({ count = 6, aspect = "aspect-[2/3]" }: { count?: number; aspect?: string }) {
  return (
    <div className="flex gap-4 overflow-hidden px-5 lg:px-8">
      {Array.from({ length: count }).map((_, index) => (
        <LoadingSkeleton key={index} className={`w-[168px] shrink-0 ${aspect}`} />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Bir şeyler ters gitti",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="surface mx-5 flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center lg:mx-8">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent/10 text-accent">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="max-w-md text-[14px] leading-relaxed text-fg-muted">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-600"
        >
          <RefreshCw className="h-4 w-4" /> Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5 text-fg-dim">
        <Inbox className="h-6 w-6" />
      </span>
      <h3 className="text-[18px] font-semibold">{title}</h3>
      <p className="max-w-md text-[14px] leading-relaxed text-fg-muted">{message}</p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-600"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-xl bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-600"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
