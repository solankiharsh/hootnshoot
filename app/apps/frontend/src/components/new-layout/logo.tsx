'use client';

export const Logo = () => {
  return (
    <div className="mt-[14px] minCustom:mt-[22px] w-full flex h-[40px] minCustom:h-[58px] items-center justify-center px-[4px] shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hootnshoot-logo.png"
        alt="Hootnshoot"
        width={156}
        height={156}
        className="h-[36px] w-[36px] min-h-[36px] min-w-[36px] rounded-[10px] minCustom:h-[56px] minCustom:w-[56px] minCustom:min-h-[56px] minCustom:min-w-[56px] minCustom:rounded-[12px] object-contain"
      />
    </div>
  );
};
