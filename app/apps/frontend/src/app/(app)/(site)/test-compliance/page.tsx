export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { TestComplianceComponent } from '@gitroom/frontend/components/test-compliance/test-compliance.component';

export const metadata: Metadata = {
  title: 'Test Compliance',
  description: 'Manually exercise the Content Cop compliance pipeline.',
};

export default async function Page() {
  return <TestComplianceComponent />;
}
