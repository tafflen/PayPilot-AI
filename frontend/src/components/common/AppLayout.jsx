import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { api } from '../../services/api';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openIncidentsCount, setOpenIncidentsCount] = useState(0);
  const location = useLocation();

  const fetchBadgeCounts = async () => {
    try {
      const res = await api.dashboard.getStats();
      if (res?.data?.kpis) {
        setOpenIncidentsCount(res.data.kpis.openIncidentsCount || 0);
      }
    } catch {
      // Degrade gracefully if stats fail temporarily
    }
  };

  useEffect(() => {
    fetchBadgeCounts();
  }, [location.pathname]);

  const handleReconciled = () => {
    fetchBadgeCounts();
  };

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        openIncidentsCount={openIncidentsCount}
      />
      <div className="main-content-wrapper">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          onReconciled={handleReconciled}
        />
        <main className="main-viewport">
          <Outlet context={{ refreshBadges: fetchBadgeCounts }} />
        </main>
      </div>

      <style>{`
        .app-shell {
          display: flex;
          min-height: 100vh;
          background-color: var(--bg-app);
        }

        .main-content-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .main-viewport {
          flex: 1;
          background-color: var(--bg-app);
        }
      `}</style>
    </div>
  );
}
