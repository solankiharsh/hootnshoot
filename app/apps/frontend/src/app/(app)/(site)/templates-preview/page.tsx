import { Metadata } from 'next';
import { DecomposePreview } from '@gitroom/frontend/components/templates/decompose-preview.component';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Hootnshoot — Magic Design Preview',
  description: 'Decompose an image into editable openpolotno layers.',
};

export default function TemplatesPreviewPage() {
  return <DecomposePreview />;
}
