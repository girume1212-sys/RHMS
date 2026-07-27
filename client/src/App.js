import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';
import Login from './components/Login';
import Signup from './components/Signup';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import DeveloperDashboard from './components/DeveloperDashboard';
import EscalationDashboard from './components/EscalationDashboard';
import RequestsList from './components/RequestsList';
import CreateRequest from './components/CreateRequest';
import RequestDetail from './components/RequestDetail';
import Users from './components/Users';
import Categories from './components/Categories';
import Priorities from './components/Priorities';
import Roles from './components/Roles';
import Groups from './components/Groups';
import Feedback from './components/Feedback';
import Reports from './components/Reports';
import ActivityLog from './components/ActivityLog';
import Settings from './components/Settings';
import Company from './components/Company';
import ClientLayout from './components/ClientLayout';
import ClientDashboard from './components/ClientDashboard';
import ClientProfile from './components/ClientProfile';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'client') return <Navigate to="/client" />;
    return <Navigate to="/" />;
  }
  return children;
}

function RoleDashboard() {
  const { user } = useAuth();
  if (user?.role === 'developer') return <DeveloperDashboard />;
  if (user?.role === 'support') return <EscalationDashboard />;
  return <Dashboard />;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? (user.role === 'client' ? <Navigate to="/client" /> : <Navigate to="/" />) : <Login />} />
      <Route path="/signup" element={user ? <Navigate to="/" /> : <Signup />} />
      <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'support', 'developer']}><Layout /></ProtectedRoute>}>
        <Route index element={<RoleDashboard />} />
        <Route path="requests" element={<RequestsList />} />
        <Route path="requests/create" element={<CreateRequest />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="categories" element={<Categories />} />
        <Route path="company" element={<Company />} />
        <Route path="priorities" element={<Priorities />} />
        <Route path="roles" element={<Roles />} />
        <Route path="groups" element={<Groups />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/client" element={<ProtectedRoute allowedRoles={['client']}><ClientLayout /></ProtectedRoute>}>
        <Route index element={<ClientDashboard />} />
        <Route path="requests" element={<RequestsList />} />
        <Route path="requests/create" element={<CreateRequest />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="profile" element={<ClientProfile />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
