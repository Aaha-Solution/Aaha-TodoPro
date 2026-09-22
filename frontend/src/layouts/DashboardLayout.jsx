import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import LineStopperBanner from '../components/LineStopperBanner';
import LineStopperModal from '../components/LineStopperModal';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isCreateRequest = location.pathname.includes('/create-request');

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      <Sidebar isOpen={sidebarOpen} closeSidebar={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col lg:pl-64 transition-all">
        <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full transition-all">
          {/* Global Line Stopper Alert Banner (hidden on Create Production Request) */}
          {!isCreateRequest && <LineStopperBanner />}
          <Outlet />
        </main>
      </div>

      {/* Global Line Stopper Modal */}
      <LineStopperModal />
    </div>
  );
};

export default DashboardLayout;
