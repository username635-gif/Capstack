"use client";

import React from 'react';
import { AlertCircle } from 'lucide-react';

export const ErrorState = ({ message, onRetry, lastSuccessful }: { message: string; onRetry: () => void; lastSuccessful?: string | null }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-3">
    <AlertCircle className="text-[#A32D2D]" size={22} />
    <p className="text-[13px] text-[#5F5E5A]">{message}</p>
    {lastSuccessful && (
      <p className="text-[11px] text-[#888780]">Last successful load: {lastSuccessful}</p>
    )}
    <button onClick={onRetry} className="px-4 py-1.5 text-[13px] border border-[rgba(0,0,0,0.10)] rounded-lg hover:bg-[#F8F8F7] text-[#1A1A18]">
      Retry
    </button>
  </div>
);

export default ErrorState;
