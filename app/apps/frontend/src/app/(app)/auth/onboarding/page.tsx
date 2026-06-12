export const dynamic = 'force-dynamic';
import { OnboardingComponent } from '@gitroom/frontend/components/auth/onboarding.component';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hootnshoot — Set up your workspace',
  description: '',
};

export default function OnboardingPage() {
  return <OnboardingComponent />;
}
