'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

const Polonto = dynamic(
  () => import('@gitroom/frontend/components/launches/polonto'),
  { ssr: false }
);

export default function DesignMediaPage() {
  const router = useRouter();
  const toaster = useToaster();
  const t = useT();
  const [key, setKey] = useState(0);

  const handleNewDesign = useCallback(() => {
    setKey((k) => k + 1);
  }, []);

  const dummySetMedia = useCallback(() => {}, []);

  return (
    <div className="bg-newBgColorInner flex flex-col flex-1 transition-all">
      <div className="flex items-center justify-between p-[16px]">
        <h1 className="text-[20px] font-[600] text-white">
          {t('design_media', 'Design Media')}
        </h1>
        <div className="flex gap-[8px]">
          <button
            onClick={handleNewDesign}
            className="cursor-pointer h-[36px] px-[16px] items-center justify-center bg-btnSimple changeColor flex rounded-[8px] text-[14px] font-[500]"
          >
            {t('new_design', 'New Design')}
          </button>
          <button
            onClick={() => router.push('/media')}
            className="cursor-pointer h-[36px] px-[16px] items-center justify-center border border-newTextColor/20 flex rounded-[8px] text-[14px] font-[500] text-white"
          >
            {t('view_media', 'View Media')}
          </button>
        </div>
      </div>
      <div className="flex-1 px-[16px] pb-[16px] min-h-0">
        <Polonto key={key} setMedia={dummySetMedia} closeModal={() => {}} fullHeight={true} />
      </div>
    </div>
  );
}
