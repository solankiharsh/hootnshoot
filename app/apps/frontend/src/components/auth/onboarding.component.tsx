'use client';

import { useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export function OnboardingComponent() {
  const fetch = useFetch();
  const [mode, setMode] = useState<'personal' | 'organization' | null>(null);
  const [company, setCompany] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!mode) return;
    if (mode === 'organization' && company.trim().length < 2) {
      setError('Please enter your organization name');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/user/setup-workspace', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          ...(mode === 'organization' ? { company: company.trim() } : {}),
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        setError(msg || 'Something went wrong. Please try again.');
        setLoading(false);
        return;
      }
      window.location.assign('/launches');
    } catch {
      setError('Could not reach the server. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-[24px]">
      <div className="mb-[8px]">
        <h1
          className="text-[32px] font-[700] text-[#1A1A1A] mb-[8px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '-0.5px' }}
        >
          Set up your workspace
        </h1>
        <p className="text-[14px]" style={{ color: '#888480' }}>
          How will you be using Hootnshoot?
        </p>
      </div>

      <div className="flex flex-col gap-[12px]">
        <button
          type="button"
          onClick={() => { setMode('personal'); setError(''); }}
          className="text-left p-[20px] rounded-[12px] border-[2px] transition-all"
          style={{
            borderColor: mode === 'personal' ? '#1A1A1A' : '#E0DDD8',
            background: mode === 'personal' ? '#F8F7F5' : '#fff',
          }}
        >
          <div className="flex items-start gap-[14px]">
            <div className="text-[28px] mt-[-2px]">👤</div>
            <div>
              <div className="font-[600] text-[15px] text-[#1A1A1A]">Personal</div>
              <div className="text-[13px] mt-[4px]" style={{ color: '#888480' }}>
                Just for you — manage your own social accounts independently.
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => { setMode('organization'); setError(''); }}
          className="text-left p-[20px] rounded-[12px] border-[2px] transition-all"
          style={{
            borderColor: mode === 'organization' ? '#1A1A1A' : '#E0DDD8',
            background: mode === 'organization' ? '#F8F7F5' : '#fff',
          }}
        >
          <div className="flex items-start gap-[14px]">
            <div className="text-[28px] mt-[-2px]">🏢</div>
            <div>
              <div className="font-[600] text-[15px] text-[#1A1A1A]">Organization</div>
              <div className="text-[13px] mt-[4px]" style={{ color: '#888480' }}>
                For a team or company — collaborate and share social accounts.
              </div>
            </div>
          </div>
        </button>
      </div>

      {mode === 'organization' && (
        <div className="flex flex-col gap-[8px]">
          <label className="text-[13px] font-[500] text-[#1A1A1A]">
            Organization name
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => { setCompany(e.target.value); setError(''); }}
            placeholder="e.g. Acme Inc, My Company, My Team"
            autoFocus
            className="w-full px-[14px] py-[12px] rounded-[10px] text-[14px] text-[#1A1A1A] outline-none"
            style={{
              border: '1.5px solid #E0DDD8',
              background: '#fff',
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          />
        </div>
      )}

      {error && (
        <p className="text-[13px]" style={{ color: '#DC2626' }}>{error}</p>
      )}

      <button
        type="button"
        disabled={!mode || loading}
        onClick={handleSubmit}
        className="w-full py-[14px] rounded-[10px] text-[15px] font-[600] text-white transition-all"
        style={{
          background: !mode ? '#C8C5C0' : '#1A1A1A',
          cursor: !mode || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Setting up…' : 'Continue'}
      </button>
    </div>
  );
}
