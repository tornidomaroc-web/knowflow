'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';
import { LatinText } from '@/components/ui/LatinText';
import { ClaySectionTitle } from '@/components/clay/ClaySectionTitle';
import { ClayStar } from '@/components/clay/ClayIcons';
import { useIap, useStore } from './IapProvider';

export interface AppStoreManageLabels {
  manageHeading: string;
  manageApp: string;
  manageWeb: string;
  manage: string;
  manageFailed: string;
  deleteNote: string;
}

/**
 * The App Store's own management sheet (StoreKit `showManageSubscriptions`),
 * opened by the plugin. Only where the plugin answers; elsewhere the caller
 * shows plain text that says where to go, with no button and no link.
 */
function ManageButton({ label, failed }: { label: string; failed: string }) {
  const { call } = useStore();
  const iap = useIap();
  const [error, setError] = useState(false);
  if (!call && !iap?.preview) return null;
  return (
    <>
      <Button
        variant="secondary"
        data-kf-iap-manage=""
        className="mt-3 w-full sm:w-auto"
        onClick={async () => {
          setError(false);
          try {
            if (call) await call('manageSubscriptions');
          } catch {
            setError(true);
          }
        }}
      >
        <LatinText text={label} />
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          <LatinText text={failed} />
        </p>
      )}
    </>
  );
}

/** Whether this web view can open the App Store sheet (shell 2 with the plugin, or a preview). */
function useCanManage(): boolean {
  const { call } = useStore();
  const iap = useIap();
  return !!call || !!iap?.preview;
}

/**
 * R1 (#337): Pro bought in the app is managed in the App Store, not by the
 * Paddle cancel card (which would answer "nothing to cancel" and read as a
 * false cancellation). In the app: one line and the Manage button. On the
 * web and in build 8: one line saying where, no button.
 */
export function AppStoreManageCard({ labels }: { labels: AppStoreManageLabels }) {
  const can = useCanManage();
  const marked = useIap() ? { 'data-kf-iap': 'manage' } : {};
  return (
    <Card data-kf-apple-manage="" {...marked} className="p-5">
      <ClaySectionTitle icon={<ClayStar />}>
        <LatinText text={labels.manageHeading} />
      </ClaySectionTitle>
      <p className="mt-3 text-sm text-foreground">
        <LatinText text={can ? labels.manageApp : labels.manageWeb} />
      </p>
      <ManageButton label={labels.manage} failed={labels.manageFailed} />
    </Card>
  );
}

/**
 * R2 (Apple 5.1.1(v)): deleting the account does not cancel an App Store
 * subscription. Shown inside the delete card only while Apple may still bill
 * (EntitlementSources.appleBilling), with the Manage button where it works.
 */
export function AppStoreDeleteNote({ labels }: { labels: AppStoreManageLabels }) {
  const marked = useIap() ? { 'data-kf-iap': 'delete-note' } : {};
  return (
    <div data-kf-apple-delete-note="" {...marked} className="mb-4">
      <p className="text-xs font-medium text-foreground">
        <LatinText text={labels.deleteNote} />
      </p>
      <ManageButton label={labels.manage} failed={labels.manageFailed} />
    </div>
  );
}
