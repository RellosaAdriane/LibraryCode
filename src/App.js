import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './login';
import ForgotPassword from './ForgotPassword';
import Dashboard from './Dashboard';
import StudentDashboard from './StudentDashboard';
import StudentHome from './pages/student/StudentHome';
import Books from './pages/student/Books';
import Borrowed from './pages/student/Borrowed';
import Returned from './pages/student/Returned';
import Profile from './pages/student/Profile';
import Settings from './pages/student/Settings';
import { getUserRole, isAuthenticated } from './auth';
import './index.css';

const roleHomePath = () => (getUserRole() === 'admin' ? '/admin-dashboard' : '/student-dashboard');

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
    </Router>
  );
}

export default App;
