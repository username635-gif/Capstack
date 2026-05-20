"use client";

import React from 'react';
import Link from 'next/link';

export default function Sidebar() {
  return (
    <aside className="w-52 flex-shrink-0 h-screen border-r border-[rgba(0,0,0,0.10)] bg-[#FFFFFF] p-4 fixed" aria-label="Capstack Ops main navigation">
      <div className="mb-6">
        <h1 className="text-[15px] font-medium">Capstack Ops</h1>
        <div className="text-[13px] text-[#888780]">Internal ops console</div>
      </div>

      <nav className="mt-6 space-y-3 text-[13px]" aria-label="Main navigation">
        <Link href="/applications" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]" aria-current="page">
          <span className="text-[#185FA5]">Applications</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#E6F1FB] text-[#185FA5]" aria-label="12 applications pending">12</span>
        </Link>

        <Link href="/collections" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]">
          <span className="text-[#5F5E5A]">Collections</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#FCEBEB] text-[#A32D2D]" aria-label="5 collections active">5</span>
        </Link>

        <Link href="/kyc-aml" className="flex items-center justify-between px-2 py-2 rounded hover:bg-[#F8F8F7] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]">
          <span className="text-[#5F5E5A]">KYC / AML</span>
          <span className="text-[11px] px-2 py-0.5 rounded bg-[#FAEEDA] text-[#854F0B]" aria-label="3 KYC/AML items">3</span>
        </Link>

        <div className="border-t mt-4 pt-3 text-[13px]">
          <h2 className="font-medium mb-2">Tools</h2>
          <Link href="/reports" className="block py-1 text-[#5F5E5A] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]">Reports</Link>
          <Link href="/calculator" className="block py-1 text-[#5F5E5A] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]">Calculator</Link>
          <Link href="/settings" className="block py-1 text-[#5F5E5A] focus:outline-2 focus:outline-offset-2 focus:outline-[#185FA5]">Settings</Link>
        </div>

      </nav>

      <footer className="mt-auto absolute bottom-4 left-4 text-[13px]">
        <div className="text-[13px]" aria-label="Logged-in user info">User · Role</div>
      </footer>
    </aside>
  );
}
