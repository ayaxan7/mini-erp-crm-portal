import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...props,
  };
}

export function GridIcon(props: IconProps) {
  return <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>;
}

export function UsersIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>;
}

export function BoxIcon(props: IconProps) {
  return <svg {...base(props)}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
  </svg>;
}

export function ImageIcon(props: IconProps) {
  return <svg {...base(props)}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
  </svg>;
}

export function DocumentIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
    <path d="M16 13H8" /><path d="M16 17H8" />
  </svg>;
}

export function TrendIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" />
  </svg>;
}

export function AlertIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>;
}

export function EyeIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>;
}

export function EyeSlashIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
    <path d="M12 9a3 3 0 0 1 3 3" />
    <path d="M4 4l16 16" />
  </svg>;
}

export function LogOutIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" />
  </svg>;
}

export function SearchIcon(props: IconProps) {
  return <svg {...base(props)}>
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
  </svg>;
}

export function PlusIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>;
}

export function CheckIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>;
}

export function XIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
  </svg>;
}

export function BadgeDollarIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M20 7h-9" /><path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </svg>;
}

export function PencilIcon(props: IconProps) {
  return <svg {...base(props)}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </svg>;
}