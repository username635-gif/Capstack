"use client";

import React from 'react';
import { LucideIcon } from 'lucide-react';

type PillVariant = 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'gray';

export const Pill = ({ variant = 'gray', icon: Icon, children }: { variant?: PillVariant; icon?: LucideIcon; children: React.ReactNode }) => {
  const styles: Record<PillVariant, string> = {
    green:  'bg-[#EAF3DE] text-[#3B6D11] border-[#639922]',
    amber:  'bg-[#FAEEDA] text-[#854F0B] border-[#EF9F27]',
    red:    'bg-[#FCEBEB] text-[#A32D2D] border-[#E24B4A]',
    blue:   'bg-[#E6F1FB] text-[#185FA5] border-[#378ADD]',
    purple: 'bg-[#F0EAFB] text-[#5B2D8E] border-[#9B6DD1]',
    gray:   'bg-[#F1EFE8] text-[#5F5E5A] border-[rgba(0,0,0,0.10)]',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium border ${styles[variant]}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
};

export default Pill;
