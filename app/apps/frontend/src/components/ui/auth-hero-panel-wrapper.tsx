'use client';

import dynamic from 'next/dynamic';

const AuthHeroPanel = dynamic(
  () => import('@gitroom/frontend/components/ui/auth-hero-panel'),
  { ssr: false }
);

export function AuthHeroPanelWrapper() {
  return <AuthHeroPanel />;
}
