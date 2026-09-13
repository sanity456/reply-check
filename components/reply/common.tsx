'use client';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { safeAttribution, short } from '@/lib/reply/core';
import type { Address, Operation } from '@/lib/reply/types';

export function Field({
  label,
  id,
  help,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  help?: string;
  id: string;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Input
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        {...props}
      />
      {help && (
        <p id={`${id}-help`} className="muted">
          {help}
        </p>
      )}
    </div>
  );
}
export function Notice({
  children,
  kind = 'info',
}: {
  children: ReactNode;
  kind?: 'info' | 'error' | 'success' | 'warning';
}) {
  return (
    <div
      className={`notice ${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}
export function CopyButton({
  value,
  label = 'Copy',
  disabled = false,
}: {
  value: string;
  label?: string;
  disabled?: boolean;
}) {
  const [copyState, setCopyState] = useState({ value: '', message: '' });
  const message = copyState.value === value ? copyState.message : '';
  return (
    <span className="copy-control">
      <Button
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopyState({ value, message: 'Copied' });
          } catch {
            setCopyState({
              value,
              message:
                'Copy unavailable. Select the text and copy it manually.',
            });
          }
        }}
      >
        {message === 'Copied' ? <Check /> : <Copy />}
        {label}
      </Button>
      <span className="muted" aria-live="polite">
        {message}
      </span>
    </span>
  );
}
export function DownloadButton({
  value,
  name,
}: {
  value: unknown;
  name: string;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(value, null, 2)], {
            type: 'application/json',
          }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <Download /> Export JSON
    </Button>
  );
}
export function Attribution({ url }: { url: string }) {
  return url && safeAttribution(url) ? (
    <a
      className="text-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
    >
      Attribution <ExternalLink size={13} />
    </a>
  ) : null;
}
export function Timestamp({ value }: { value: string }) {
  // Store and export original chain time. Display UTC consistently across browsers.
  const date = new Date(value);
  return (
    <time dateTime={value}>
      {Number.isNaN(date.valueOf())
        ? 'Time unavailable'
        : date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC'}
    </time>
  );
}
export function Confirmation({
  operation,
  account,
  busy,
  onCancel,
  onConfirm,
}: {
  operation: Operation | null;
  account: Address | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [consent, setConsent] = useState(false);
  return (
    <Dialog
      open={!!operation}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setConsent(false);
          onCancel();
        }
      }}
    >
      <DialogContent className="confirmation-dialog" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{operation?.title}</DialogTitle>
          <DialogDescription>
            One wallet-signed action on GenLayer Studionet.
          </DialogDescription>
        </DialogHeader>
        <dl className="confirmation-meta">
          <dt>Wallet</dt>
          <dd title={account ?? ''}>
            {account ? short(account) : 'Not connected'}
          </dd>
          <dt>Contract payment</dt>
          <dd>0 GEN · network fees may apply</dd>
        </dl>
        <div className="confirmation-details">
          {operation?.details.map((detail, index) => (
            <p key={index}>{detail}</p>
          ))}
        </div>
        {operation?.containsPublicText && (
          <Notice kind="warning">
            This content and your wallet address can become public permanently,
            even if the transaction fails. Remove private tickets, personal
            details and secrets.
          </Notice>
        )}
        <label className="consent-row">
          <Checkbox
            checked={consent}
            onCheckedChange={(v) => setConsent(v === true)}
            disabled={busy}
          />
          <span>
            {operation?.containsPublicText
              ? 'I checked the content and agree to publish it.'
              : 'I reviewed the action and wallet address.'}
          </span>
        </label>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setConsent(false);
              onCancel();
            }}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            disabled={!consent || !account || busy}
            onClick={() => {
              setConsent(false);
              onConfirm();
            }}
          >
            {busy ? 'Waiting for wallet…' : 'Continue to wallet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
