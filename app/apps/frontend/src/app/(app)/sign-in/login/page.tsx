export const dynamic = 'force-dynamic';
import { Login } from '@gitroom/frontend/components/auth/login';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hootnshoot — Login',
  description: '',
};

export default function LoginPage() {
  return <Login />;
}
