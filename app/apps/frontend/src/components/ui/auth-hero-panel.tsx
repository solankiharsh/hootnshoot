'use client';

export default function AuthHeroPanel() {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#DEDAD4' }}>
      {/* Full-bleed illustration — mix-blend-mode:multiply turns white → the bg gray */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/illus-thinking.png"
        alt=""
        aria-hidden
        className="absolute bottom-0 right-0 w-[95%] max-w-[620px] object-contain object-bottom pointer-events-none select-none"
        style={{ mixBlendMode: 'multiply' }}
      />

      {/* Tagline — top-left, clear of the illustration */}
      <div className="relative z-10 px-[48px] pt-[36px] max-w-[400px]">
        <h2
          className="text-[40px] font-[700] leading-[1.15] text-[#1A1A1A] mb-[14px]"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          Schedule smarter.
          <br />
          Post bolder.
        </h2>
        <p className="text-[15px] leading-[1.6]" style={{ color: '#6B6762' }}>
          Hootnshoot. Where scheduling meets creativity.
        </p>
      </div>
    </div>
  );
}
