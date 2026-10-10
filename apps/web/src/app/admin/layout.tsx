import type { Metadata } from 'next';
import AdminGate from '@/components/AdminGate';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

/**
 * Every route under /admin is wrapped in the key gate. Veyra itself needs no
 * account, but the dashboard can delete catalogue entries and issue upload URLs,
 * so it stays locked — server-side check, key held for the tab only.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminGate>{children}</AdminGate>;
}
