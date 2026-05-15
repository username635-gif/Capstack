'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import OpsLayout from './_components/OpsLayout';

const stats = [
  { label: 'Active loans', value: '1 284', delta: '+12 today' },
  { label: 'Pending applications', value: '47', delta: '8 urgent' },
  { label: 'Total disbursed', value: 'R 42.1M', delta: '+R 320k this week' },
  { label: 'Delinquency rate', value: '3.2%', delta: '-0.4% vs last month' },
];

const applications = [
  { id: 'a1', ref: 'APP-2026-04891', borrower: 'Sipho Dlamini', amount: 'R 25 000', product: 'Personal', status: 'Pending review', risk: 'B' },
  { id: 'a2', ref: 'APP-2026-04890', borrower: 'Naledi Mokoena', amount: 'R 120 000', product: 'Business', status: 'Awaiting docs', risk: 'A' },
  { id: 'a3', ref: 'APP-2026-04889', borrower: 'James van der Merwe', amount: 'R 8 000', product: 'Short-Term', status: 'Approved', risk: 'C' },
  { id: 'a4', ref: 'APP-2026-04888', borrower: 'Fatima Cassim', amount: 'R 50 000', product: 'Personal', status: 'Declined', risk: 'D' },
  { id: 'a5', ref: 'APP-2026-04887', borrower: 'Thabo Nkosi', amount: 'R 35 000', product: 'Personal', status: 'Pending review', risk: 'B' },
];

const statusColor: Record<string, string> = {
  'Pending review': 'var(--badge-pending-bg)',
  'Awaiting docs': 'var(--badge-awaiting-bg)',
  Approved: 'var(--badge-approved-bg)',
  Declined: 'var(--badge-declined-bg)',
};

const statusFg: Record<string, string> = {
  'Pending review': 'var(--badge-pending-fg)',
  'Awaiting docs': 'var(--badge-awaiting-fg)',
  Approved: 'var(--badge-approved-fg)',
  Declined: 'var(--badge-declined-fg)',
};

export default function OpsHome() {
  const router = useRouter();

  return (
    <OpsLayout
      title="Dashboard"
      action={
        <Link
          href="/applications/new"
          className="text-sm px-4 py-2 rounded-lg font-semibold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          + New application
        </Link>
      }
    >
      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <div className="text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
              {stat.label}
            </div>
            <div className="text-2xl font-black">{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
              {stat.delta}
            </div>
          </div>
        ))}
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <span className="font-bold">Application queue</span>
          <Link href="/applications" className="text-xs" style={{ color: 'var(--color-secondary)' }}>
            View all
          </Link>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              {['Reference', 'Borrower', 'Amount', 'Product', 'Risk', 'Status', 'Action'].map((header) => (
                <th
                  key={header}
                  className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {applications.map((application, index) => (
              <tr
                key={application.ref}
                style={{ borderBottom: index < applications.length - 1 ? '1px solid var(--color-border)' : 'none' }}
              >
                <td className="px-6 py-4 font-mono text-xs" style={{ color: 'var(--color-muted)' }}>
                  {application.ref}
                </td>
                <td className="px-6 py-4 font-medium">{application.borrower}</td>
                <td className="px-6 py-4 font-semibold">{application.amount}</td>
                <td className="px-6 py-4" style={{ color: 'var(--color-muted)' }}>
                  {application.product}
                </td>
                <td className="px-6 py-4">
                  <span
                    className="font-bold text-xs px-2 py-0.5 rounded"
                    style={{ background: 'var(--color-surface-2)', color: 'var(--color-secondary)' }}
                  >
                    {application.risk}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className="text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ background: statusColor[application.status], color: statusFg[application.status] }}
                  >
                    {application.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => router.push(`/applications/${application.id}`)}
                    className="text-xs px-3 py-1 rounded-lg font-medium"
                    style={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                    }}
                  >
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OpsLayout>
  );
}