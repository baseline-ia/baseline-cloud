'use client';

import { useState } from 'react';
import { Menu, X } from 'lucide-react';

export function SidebarToggle() {
  const [isOpen, setIsOpen] = useState(false);

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    document.body.dataset.sidebarOpen = next ? 'true' : '';
  }

  return (
    <button
      className="sidebar-toggle"
      onClick={handleToggle}
      aria-expanded={isOpen}
      aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
      title={isOpen ? 'Close sidebar' : 'Open sidebar'}
    >
      {isOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );
}
