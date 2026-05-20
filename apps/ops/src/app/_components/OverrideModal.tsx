"use client";

import React from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { actor: string; reason: string; newDecision: string }) => void;
};

export default function OverrideModal({ open, onClose, onSubmit }: Props) {
  const [reason, setReason] = React.useState('');
  const [actor, setActor] = React.useState('');
  const [decision, setDecision] = React.useState('HUMAN_OVERRIDE');

  if (!open) return null;

  const disabled = reason.trim().length < 20 || !actor.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-[13px] font-medium mb-3">Override decision</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#888780]">Approving officer</label>
            <input value={actor} onChange={e => setActor(e.target.value)} className="w-full mt-1 p-2 border border-[rgba(0,0,0,0.10)] rounded" />
          </div>
          <div>
            <label className="text-[11px] text-[#888780]">Override reason (min 20 chars)</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} className="w-full mt-1 p-2 border border-[rgba(0,0,0,0.10)] rounded" rows={4} />
          </div>
          <div>
            <label className="text-[11px] text-[#888780]">New decision</label>
            <select value={decision} onChange={e => setDecision(e.target.value)} className="w-full mt-1 p-2 border border-[rgba(0,0,0,0.10)] rounded">
              <option value="HUMAN_OVERRIDE">Human override</option>
              <option value="APPROVE">Approve</option>
              <option value="DECLINE">Decline</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-3 py-1.5 rounded border">Cancel</button>
            <button disabled={disabled} onClick={() => onSubmit({ actor: actor.trim(), reason: reason.trim(), newDecision: decision })} className="px-3 py-1.5 rounded bg-[#5F5E5A] text-white disabled:opacity-40">Submit override</button>
          </div>
        </div>
      </div>
    </div>
  );
}
