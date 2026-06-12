import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hootnshoot - Agent',
  description: 'agents',
};

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
