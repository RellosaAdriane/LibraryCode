import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getUserRole, isAuthenticated } from './auth';
import './index.css';
import './App.css';

const Login = lazy(() => import('./login'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const Dashboard = lazy(() => import('./Dashboard'));
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const StudentHome = lazy(() => import('./pages/student/StudentHome'));
const Books = lazy(() => import('./pages/student/Books'));
const Borrowed = lazy(() => import('./pages/student/Borrowed'));
const Returned = lazy(() => import('./pages/student/Returned'));
const Profile = lazy(() => import('./pages/student/Profile'));
const Settings = lazy(() => import('./pages/student/Settings'));

const roleHomePath = () => (getUserRole() === 'admin' ? '/admin-dashboard' : '/student-dashboard');

const RouteLoadingFallback = () => (
  <div className="app-route-loading" role="status" aria-live="polite">
    Loading...
  </div>
);

const AdminOnlyRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (getUserRole() !== 'admin') {
    return <Navigate to="/student-dashboard" replace />;
  }
  return children;
};

const StudentAreaRoute = ({ children }) => {
  if (getUserRole() === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return children;
};

const StudentOnlyRoute = ({ children }) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  if (getUserRole() === 'admin') {
    return <Navigate to="/admin-dashboard" replace />;
  }
  return children;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated() ? <Navigate to={roleHomePath()} replace /> : <Login />} 
          />
          <Route
            path="/forgot-password"
            element={isAuthenticated() ? <Navigate to={roleHomePath()} replace /> : <ForgotPassword />}
          />
          <Route 
            path="/admin-dashboard"
            element={(
              <AdminOnlyRoute>
                <Dashboard />
              </AdminOnlyRoute>
            )}
          />
          <Route
            path="/dashboard"
            element={isAuthenticated() ? <Navigate to={roleHomePath()} replace /> : <Navigate to="/student-dashboard" replace />}
          />
          <Route 
            path="/student-dashboard" 
            element={(
              <StudentAreaRoute>
                <StudentDashboard />
              </StudentAreaRoute>
            )}
          >
            <Route index element={<StudentHome />} />
            <Route path="books" element={<Books />} />
            <Route path="borrowed" element={<StudentOnlyRoute><Borrowed /></StudentOnlyRoute>} />
            <Route path="returned" element={<StudentOnlyRoute><Returned /></StudentOnlyRoute>} />
            <Route path="profile" element={<StudentOnlyRoute><Profile /></StudentOnlyRoute>} />
            <Route path="settings" element={<StudentOnlyRoute><Settings /></StudentOnlyRoute>} />
          </Route>
          <Route 
            path="/" 
            element={<Navigate to="/student-dashboard" replace />} 
          />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;