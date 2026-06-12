import { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Hootnshoot - Agent',
  description: '',
};

export default async function Page() {
  return redirect('/launches');
}
