import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import LineStopperBanner from '../components/LineStopperBanner';
import LineStopperModal from '../components/LineStopperModal';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all">
          {/* Global Line Stopper Alert Banner */}
          <LineStopperBanner />
          <Outlet />
        </main>
      </div>

      {/* Global Line Stopper Modal */}
      <LineStopperModal />
    </div>
  );
};

export default DashboardLayout;
