'use client';

import React, { useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { showMediaBox } from '@gitroom/frontend/components/media/media.component';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  ComplianceGatePanel,
  type ComplianceJobDto,
} from '@gitroom/frontend/components/compliance/compliance-gate.panel';
import { useFeatureFlags } from '@gitroom/frontend/components/launches/helpers/use.feature.flags';
import { CompliancePreviewBanner } from '@gitroom/frontend/components/compliance/compliance-preview-banner';

const PLATFORMS = ['Instagram', 'Facebook', 'X', 'TikTok', 'LinkedIn'] as const;
type Platform = (typeof PLATFORMS)[number];

interface TestSubmitResponse {
  job: ComplianceJobDto;
  postGroupId: string;
  platform: string;
  integrationProvider: string;
}

export const TestComplianceComponent: React.FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { complianceEnabled } = useFeatureFlags();

  const [caption, setCaption] = useState<string>('');
  const [platform, setPlatform] = useState<Platform>('Instagram');
  const [imagePath, setImagePath] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TestSubmitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openMediaPicker = useCallback(() => {
    showMediaBox((value) => {
      const v = value as { id: string; path: string };
      setImagePath(v.path);
    });
  }, []);

  const submit = useCallback(async () => {
    setError(null);
    setResult(null);
    if (!caption.trim() && !imagePath.trim()) {
      setError('Add a caption or pick an image first.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/compliance/test-submit', {
        method: 'POST',
        body: JSON.stringify({
          captionText: caption,
          imageUrl: imagePath,
          platform,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setError(body.message ?? `Submit failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as TestSubmitResponse;
      setResult(data);
      toaster.show('Submitted to Content Cop — watching for callback', 'success');
    } finally {
      setSubmitting(false);
    }
  }, [fetch, caption, imagePath, platform, toaster]);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  if (!complianceEnabled) {
    return (
      <div className="p-[32px] max-w-[680px] mx-auto">
        <h1 className="text-[24px] font-[600] mb-[12px]">Test Compliance</h1>
        <div className="bg-yellow-500/10 border border-yellow-500 rounded-[6px] p-[16px] text-[14px]">
          Compliance is disabled in this build. Set{' '}
          <code className="bg-customColor2 px-[6px] py-[2px] rounded">COMPLIANCE_ENABLED=true</code>{' '}
          in <code>.env</code> and restart the backend to enable.
        </div>
      </div>
    );
  }

  return (
    <div className="p-[32px] max-w-[760px] mx-auto flex flex-col gap-[20px]">
      <div>
        <h1 className="text-[24px] font-[600]">Test Compliance</h1>
        <p className="text-[13px] text-customColor18 mt-[4px]">
          Submit a caption + image to Content Cop and watch the verdict come back. Creates a
          throwaway draft post bound to a connected social integration. Does not publish.
        </p>
      </div>

      {!result ? (
        <div className="bg-sixth border border-fifth rounded-[6px] p-[24px] flex flex-col gap-[16px]">
          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-[600]">Caption</label>
            <textarea
              className="bg-customColor2 border border-customColor6 rounded-[4px] p-[10px] text-[14px] min-h-[100px]"
              placeholder="Type the caption you want Content Cop to review..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
            <CompliancePreviewBanner caption={caption} platform={platform} />
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-[600]">Image</label>
            <div className="flex items-center gap-[12px]">
              <Button onClick={openMediaPicker}>Pick / Upload image</Button>
              {imagePath && (
                <button
                  type="button"
                  onClick={() => setImagePath('')}
                  className="text-[12px] text-customColor18 hover:text-newTextColor underline"
                >
                  Clear
                </button>
              )}
            </div>
            {imagePath && (
              <div className="mt-[8px]">
                <img
                  src={imagePath}
                  alt="selected"
                  className="max-h-[200px] rounded-[4px] border border-customColor6"
                />
                <div className="text-[11px] font-mono text-customColor18 mt-[4px] break-all">
                  {imagePath}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[6px]">
            <label className="text-[13px] font-[600]">Platform</label>
            <select
              className="bg-customColor2 border border-customColor6 rounded-[4px] p-[8px] text-[14px]"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-customColor18">
              You must have a connected {platform} integration for the test post to attach.
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-200 rounded-[4px] p-[10px] text-[13px]">
              {error}
            </div>
          )}

          <div className="flex items-center gap-[12px]">
            <Button onClick={submit} loading={submitting}>
              Submit to Content Cop
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-[16px]">
          <div className="bg-sixth border border-fifth rounded-[6px] p-[16px] text-[12px] flex flex-col gap-[6px]">
            <div className="flex justify-between">
              <span className="text-customColor18">postGroupId</span>
              <span className="font-mono">{result.postGroupId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-customColor18">externalJobId</span>
              <span className="font-mono">{result.job.externalJobId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-customColor18">platform</span>
              <span>{result.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-customColor18">integration provider</span>
              <span className="font-mono">{result.integrationProvider}</span>
            </div>
          </div>

          <ComplianceGatePanel
            postGroupId={result.postGroupId}
            platform={result.platform}
            initialJob={result.job}
            autoSubmit={false}
            onApproved={() =>
              toaster.show('Content Cop approved this submission', 'success')
            }
            onClose={reset}
          />

          <div>
            <button
              type="button"
              onClick={reset}
              className="text-[13px] text-customColor18 hover:text-newTextColor underline"
            >
              ← Submit another test
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
