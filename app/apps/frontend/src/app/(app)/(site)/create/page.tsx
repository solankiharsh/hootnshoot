export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { CreatePostComponent } from '@gitroom/frontend/components/create-post/create-post.component';

export const metadata: Metadata = {
  title: 'Hootnshoot Create Post',
  description: '',
};

export default async function Index() {
  return <CreatePostComponent />;
}
