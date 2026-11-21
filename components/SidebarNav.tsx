import React from 'react';
import Link from 'next/link';

type ActiveItem = 'home' | 'drive';

interface SidebarNavProps {
  active: ActiveItem;
}

// Sections that exist in the design but have no feature behind them yet.
// Rendered dimmed and non-interactive instead of as links to "#".
const UNAVAILABLE_ITEMS: Array<{ icon: string; label: string; dividerBefore?: boolean }> = [
  { icon: 'computer', label: 'Computers' },
  { icon: 'people', label: 'Shared with me', dividerBefore: true },
  { icon: 'schedule', label: 'Recent' },
  { icon: 'star_border', label: 'Starred' },
  { icon: 'delete', label: 'Trash', dividerBefore: true },
];

export default function SidebarNav({ active }: SidebarNavProps) {
  return (
    <nav className="space-y-0.5">
      <Link href="/" className={`nav-link ${active === 'home' ? 'active' : ''}`}>
        <span className="material-icons text-[18px] mr-3">home</span>
        Home
      </Link>
      <Link href="/" className={`nav-link ${active === 'drive' ? 'active' : ''}`}>
        <span className="material-icons text-[18px] mr-3">folder</span>
        My Drive
      </Link>

      {UNAVAILABLE_ITEMS.map((item) => (
        <React.Fragment key={item.label}>
          {item.dividerBefore && <div className="h-px bg-white/[0.06] my-3"></div>}
          <span
            className="nav-link opacity-40 cursor-not-allowed"
            aria-disabled="true"
            title="Not available yet"
          >
            <span className="material-icons text-[18px] mr-3">{item.icon}</span>
            {item.label}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}
