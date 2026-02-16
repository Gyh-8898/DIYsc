import { Image } from "@tarojs/components";
import React from "react";

/**
 * 绠€鍗曠殑 SVG 鍥炬爣缁勪欢锛屾浛浠?lucide-react
 * 浣跨敤 base64 缂栫爜鐨?SVG 鎴栫畝鍗曠殑 View 缁樺埗
 */

interface IconProps {
    size?: number;
    color?: string;
    fill?: string;
    className?: string;
}

// 杈呭姪鍑芥暟锛氱敓鎴?SVG Base64
const svgToBase64 = (svgContent: string) => {
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent)}`;
};

export const Gem: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 13L2 9Z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const CircleDashed: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.1 2.18a9.93 9.93 0 0 1 3.8 0"/><path d="M17.6 3.71a9.95 9.95 0 0 1 2.69 2.7"/><path d="M21.82 10.1a9.93 9.93 0 0 1 0 3.8"/><path d="M20.29 17.6a9.95 9.95 0 0 1-2.7 2.69"/><path d="M13.9 21.82a9.94 9.94 0 0 1-3.8 0"/><path d="M6.4 20.29a9.95 9.95 0 0 1-2.69-2.7"/><path d="M2.18 13.9a9.93 9.93 0 0 1 0-3.8"/><path d="M3.71 6.4a9.95 9.95 0 0 1 2.7-2.69"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const HelpCircle: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Info: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Sparkle: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Hexagon: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const ChevronRight: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const ArrowRight: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Search: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Heart: React.FC<IconProps> = ({ size = 24, color = "#000000", fill = "none", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const ArrowLeft: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Share2: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

// --- New Icons ---

export const Settings: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Gift: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const ShoppingBag: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const MapPin: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const MessageSquare: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Edit: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Plus: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Minus: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Trash2: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const X: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Watch: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><polyline points="12 9 12 12 13.5 13.5"/><path d="M16.51 17.35l-.35 3.83a2 2 0 0 1-2 2h-4.32a2 2 0 0 1-2-2l-.35-3.83a8 8 0 0 1 0-10.7l.35-3.83a2 2 0 0 1 2-2h4.32a2 2 0 0 1 2 2l.35 3.83"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

export const Check: React.FC<IconProps> = ({ size = 24, color = "#000000", className }) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
    return <Image src={svgToBase64(svg)} style={{ width: size, height: size }} className={className} />;
};

