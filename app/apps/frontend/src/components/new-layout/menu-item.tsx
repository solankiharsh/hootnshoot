'use client';
import { FC, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import Link from 'next/link';

export const MenuItem: FC<{
  label: string;
  icon: ReactNode;
  path: string;
  onClick?: () => void;
}> = ({ label, icon, path, onClick }) => {
  const currentPath = usePathname();
  const isActive = currentPath.indexOf(path) === 0;

  const className = clsx(
    'w-full minCustom:h-[54px] custom:h-[30px] py-[8px] px-[4px] gap-[4px] flex flex-col custom:flex-row text-[10px] font-[600] items-center justify-center rounded-[12px] hover:text-textItemFocused hover:bg-boxFocused',
    isActive ? 'text-textItemFocused bg-boxFocused' : 'text-textItemBlur'
  );

  const labelClassName =
    'w-full text-center text-[10px] leading-tight custom:leading-none';

  const iconClassName =
    'custom:hidden flex items-center justify-center shrink-0';

  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        <div className={iconClassName}>{icon}</div>
        <div className={labelClassName}>{label}</div>
      </button>
    );
  }

  return (
    <Link
      prefetch={true}
      href={path}
      {...(path.indexOf('http') === 0 && { target: '_blank' })}
      className={className}
    >
      <div className={iconClassName}>{icon}</div>
      <div className={labelClassName}>{label}</div>
    </Link>
  );
};
