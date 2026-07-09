import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import RequestsList from './components/RequestsList';
import CreateRequest from './components/CreateRequest';
import RequestDetail from './components/RequestDetail';
import Users from './components/Users';
import Categories from './components/Categories';
import Priorities from './components/Priorities';
import Roles from './components/Roles';
import Reports from './components/Reports';
import ActivityLog from './components/ActivityLog';
import Settings from './components/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner"></div></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<RequestsList />} />
        <Route path="requests/create" element={<CreateRequest />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="users" element={<Users />} />
        <Route path="categories" element={<Categories />} />
        <Route path="priorities" element={<Priorities />} />
        <Route path="roles" element={<Roles />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
