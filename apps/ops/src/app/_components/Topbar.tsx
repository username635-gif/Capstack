"use client";

import React from 'react';

export const LiveIndicator = () => (
  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#EAF3DE] text-[#3B6D11] rounded-lg text-[11px] font-medium">
    <span className="w-1.5 h-1.5 rounded-full bg-[#639922] animate-pulse inline-block" />
    Live
  </span>
);

export default function Topbar({ title = 'Dashboard', subtitle = '' }: { title?: string; subtitle?: string }) {
  const formattedDate = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.05)] bg-white" style={{ marginLeft: 208 }}>
      <div>
        <div className="text-[15px] font-medium">{title}</div>
        <div className="text-[12px] text-[#888780]">{formattedDate} · <LiveIndicator /></div>
      </div>

      <div className="flex items-center gap-3">
        <button className="px-3 py-1.5 border rounded text-[13px]">Export</button>
        <button className="px-3 py-1.5 bg-[#E6F1FB] text-[#185FA5] rounded text-[13px]">Review applications (12)</button>
        <button className="px-3 py-1.5 bg-white border rounded text-[13px]">Open collections (5)</button>
      </div>
    </header>
  );
}
