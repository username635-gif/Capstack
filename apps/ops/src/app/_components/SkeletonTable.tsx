"use client";

import React from 'react';

export const SkeletonTable = ({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) => (
  <div className="animate-pulse p-6 space-y-3">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4">
        {Array.from({ length: cols }).map((_, j) => (
          <div key={j} className="h-4 bg-[#F1EFE8] rounded flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export default SkeletonTable;
