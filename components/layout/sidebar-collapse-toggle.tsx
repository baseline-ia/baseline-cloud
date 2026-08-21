'use client';

import { useState, useEffect } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

export function SidebarCollapseToggle() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Restore from localStorage
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved === 'true') {
      setCollapsed(true);
      document.body.dataset.sidebarCollapsed = 'true';
    }
  }, []);

  function handleToggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.body.dataset.sidebarCollapsed = next ? 'true' : '';
    localStorage.setItem('sidebar-collapsed', String(next));
  }

  return (
    <button
      className="sidebar-collapse-btn"
      onClick={handleToggle}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
    </button>
  );
}
