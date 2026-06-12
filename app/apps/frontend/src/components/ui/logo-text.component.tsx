import React from 'react';

export const LogoTextComponent = () => {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hootnshoot-logo.png"
        alt=""
        width={72}
        height={72}
        className="h-9 w-9 shrink-0 rounded-[10px] object-contain"
        aria-hidden
      />

      <span
        style={{
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: '19px',
          fontWeight: 700,
          letterSpacing: '-0.4px',
          color: 'currentColor',
        }}
      >
        Hootnshoot
      </span>
    </div>
  );
};
