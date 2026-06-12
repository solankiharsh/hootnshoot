'use client';

import { useCallback } from 'react';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
export const OauthProvider = () => {
  const fetch = useFetch();
  const { oauthLogoUrl, oauthDisplayName } = useVariables();
  const t = useT();
  const gotoLogin = useCallback(async () => {
    try {
      const response = await fetch('/auth/oauth/GENERIC');
      if (!response.ok) {
        const detail = (await response.text()).trim();
        throw new Error(
          `Login link request failed (${response.status})${detail ? `: ${detail}` : ''}`
        );
      }
      const link = await response.text();
      window.location.href = link;
    } catch (error) {
      console.error('Failed to get generic oauth login link:', error);
    }
  }, []);
  return (
    <div
      onClick={gotoLogin}
      style={{
        cursor: 'pointer',
        width: '100%',
        height: 52,
        borderRadius: 10,
        border: '1px solid #E2DFD9',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontSize: 15,
        fontWeight: 500,
        color: '#1A1A1A',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#F7F5F0')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
      className={``}
    >
      <div>
        <SafeImage
          src={oauthLogoUrl || '/icons/generic-oauth.svg'}
          alt="genericOauth"
          width={40}
          height={40}
          className="-mt-[7px]"
        />
      </div>
      <div>
        {t('continue_with', 'Continue with')} {oauthDisplayName || 'OAuth'}
      </div>
    </div>
  );
};
