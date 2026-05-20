"use client";

import React from 'react';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-52 flex-shrink-0 h-screen border-r border-[rgba(0,0,0,0.10)] bg-[#FFFFFF] p-4 fixed">
      <div className="mb-6">
        <div className="text-[15px] font-medium">Capstack Ops</div>
        <div className="text-[13px] text-[#888780]">Internal ops console</div>
      </div>

      <nav className="mt-6 space-y-3 text-[13px]">
        <Link href="/applications" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7]">
          <span className="text-[#185FA5]">Applications</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#E6F1FB] text-[#185FA5]">12</span>
        </Link>

        <Link href="/collections" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7]">
          <span className="text-[#5F5E5A]">Collections</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#FCEBEB] text-[#A32D2D]">5</span>
        </Link>

        <Link href="/kyc-aml" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7]">
          <span className="text-[#5F5E5A]">KYC / AML</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#FAEEDA] text-[#854F0B]">3</span>
        </Link>

        <div className="border-t mt-4 pt-3 text-[13px]">
          <div className="font-medium mb-2">Tools</div>
          <Link href="/reports" className="block py-1 text-[#5F5E5A]">Reports</Link>
          <Link href="/calculator" className="block py-1 text-[#5F5E5A]">Calculator</Link>
          <Link href="/settings" className="block py-1 text-[#5F5E5A]">Settings</Link>
        </div>

      </nav>

      <div className="mt-auto absolute bottom-4 left-4 text-[13px]">
        <div className="text-[13px]">User · Role</div>
      </div>
    </aside>
  );
}
