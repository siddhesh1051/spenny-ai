// Lucide-style SVG icons — matches the product's icon set exactly
// All icons use strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" fill="none"

type IconProps = {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

const base = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24" as const,
  fill: "none" as const,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth,
});

export const MicIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <rect x="9" y="2" width="6" height="11" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0" />
    <line x1="12" y1="19" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

export const SendIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22 11 13 2 9l20-7z" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

export const FileTextIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <line x1="10" y1="9" x2="8" y2="9" />
  </svg>
);

export const ScanLineIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <path d="M3 7V5a2 2 0 0 1 2-2h2" />
    <path d="M17 3h2a2 2 0 0 1 2 2v2" />
    <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
    <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
    <line x1="7" y1="12" x2="17" y2="12" />
  </svg>
);

export const SparklesIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3z" />
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export const SquareIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="currentColor" stroke="none" />
  </svg>
);

export const XIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ArrowUpIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

export const BarChart2Icon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2.5, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const BanknoteIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M6 12h.01M18 12h.01" />
  </svg>
);

export const MessageCircleIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export const SmartphoneIcon: React.FC<IconProps> = ({ size = 16, color = "currentColor", strokeWidth = 2, style }) => (
  <svg {...base(size, strokeWidth)} stroke={color} style={style}>
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);
