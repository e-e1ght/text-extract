/** 레일에 쓰는 선 아이콘. 획 색은 currentColor 를 따른다. */
type IconProps = { size?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function IconText({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 6.5V5h14v1.5" />
      <path d="M12 5v14" />
      <path d="M9 19h6" />
    </svg>
  );
}

export function IconPalette({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3a9 9 0 1 0 0 18 2.4 2.4 0 0 0 2.4-2.4c0-.63-.24-1.2-.63-1.63a2.4 2.4 0 0 1 1.8-4H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3Z" />
      <circle cx="7.5" cy="11.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconImage({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L16 17" />
      <path d="m14 15 1.8-1.8a2 2 0 0 1 2.8 0L20 14.5" />
    </svg>
  );
}

export function IconFrame({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M7 3v14.5a1.5 1.5 0 0 0 1.5 1.5H21" />
      <path d="M3 7h12.5A1.5 1.5 0 0 1 17 8.5V21" />
    </svg>
  );
}

export function IconHeading({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M5 5v14" />
      <path d="M13 5v14" />
      <path d="M5 12h8" />
      <path d="M16.5 19h3.5" />
      <path d="M18 19v-7l-1.5 1" />
    </svg>
  );
}

export function IconBubble({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 12.5a7 7 0 0 1-7 7H8.8L5 22v-3.6A7 7 0 0 1 4 12.5v-.5a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7Z" />
      <path d="M9 11h6" />
      <path d="M9 14.5h3.5" />
    </svg>
  );
}

export function IconSave({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M12 3.5v11" />
      <path d="m8 10.5 4 4 4-4" />
      <path d="M4.5 16.5v2A2.5 2.5 0 0 0 7 21h10a2.5 2.5 0 0 0 2.5-2.5v-2" />
    </svg>
  );
}

export function IconGear({ size = 20 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 14.5a1.6 1.6 0 0 0 .32 1.77l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.77-.32 1.6 1.6 0 0 0-.97 1.46V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.77.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.77 1.6 1.6 0 0 0-1.46-.97H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.46-1.05 1.6 1.6 0 0 0-.32-1.77l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.77.32H9a1.6 1.6 0 0 0 .97-1.46V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 .97 1.46 1.6 1.6 0 0 0 1.77-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.77V9a1.6 1.6 0 0 0 1.46.97H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.46.97Z" />
    </svg>
  );
}

export function IconUndo({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M4 8h9.5a5.5 5.5 0 1 1 0 11H8" />
      <path d="m7.5 4.5-3.5 3.5 3.5 3.5" />
    </svg>
  );
}

export function IconRedo({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 8h-9.5a5.5 5.5 0 1 0 0 11H16" />
      <path d="m16.5 4.5 3.5 3.5-3.5 3.5" />
    </svg>
  );
}

export function IconSun({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon({ size = 17 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function IconClose({ size = 15 }: IconProps) {
  return (
    <svg {...base(size)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
