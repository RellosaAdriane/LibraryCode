import React from 'react';
import './Dashboard.css';
import { useAdminDashboard } from './admin/hooks/useAdminDashboard';
import AdminLayout from './admin/components/AdminLayout';
import AdminBookFormModal from './admin/components/AdminBookFormModal';
import AdminConfirmDialog from './admin/components/AdminConfirmDialog';
import AdminUserActionMenu from './admin/components/AdminUserActionMenu';
import AdminUserProfileModal from './admin/components/AdminUserProfileModal';
import AdminHomeSection from './admin/sections/AdminHomeSection';
import AdminCirculationSection from './admin/sections/AdminCirculationSection';
import AdminBooksSection from './admin/sections/AdminBooksSection';
import AdminAnalyticsSection from './admin/sections/AdminAnalyticsSection';
import AdminActivitySection from './admin/sections/AdminActivitySection';
import AdminStudentLogsSection from './admin/sections/AdminStudentLogsSection';
import AdminUsersSection from './admin/sections/AdminUsersSection';
import AdminSettingsSection from './admin/sections/AdminSettingsSection';

const Dashboard = () => {
  const admin = useAdminDashboard();
  const { activeSection, userToast } = admin;

  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <AdminHomeSection admin={admin} />;
      case 'books':
        return <AdminBooksSection admin={admin} />;
      case 'circulation':
        return <AdminCirculationSection admin={admin} />;
      case 'analytics':
        return <AdminAnalyticsSection admin={admin} />;
      case 'activity':
        return <AdminActivitySection admin={admin} />;
      case 'student-logs':
        return <AdminStudentLogsSection admin={admin} />;
      case 'users':
        return <AdminUsersSection admin={admin} />;
      case 'settings':
        return <AdminSettingsSection admin={admin} />;
      default:
        return <AdminHomeSection admin={admin} />;
    }
  };

  return (
    <>
      <AdminLayout admin={admin}>
        {renderSection()}
      </AdminLayout>

      <AdminBookFormModal admin={admin} />
      {userToast && <div className="user-toast" role="status">{userToast}</div>}
      <AdminUserActionMenu admin={admin} />
      <AdminUserProfileModal admin={admin} />
      <AdminConfirmDialog admin={admin} />
    </>
  );
};

export default Dashboard;
