import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import Home from './pages/Home';
import Header from './components/Header';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Catalog from './pages/Catalog';
import CreateOrder from './pages/CreateOrder';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import Queue from './pages/Queue';
import NotFound from './components/NotFound';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import AdminUsers from './pages/AdminUsers';
import Financier from './pages/Financier';
import GenDirector from './pages/GenDirector';
import Approver from './pages/Approver';
import Director from './pages/Director';
import './App.css';

const NO_HEADER_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  const showHeader = isAuthenticated && !NO_HEADER_PATHS.includes(location.pathname);

  return (
    <>
      {showHeader && <Header />}
      <main className={showHeader ? 'md:ml-[240px] mt-0' : ''}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Home />} />

          <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
          <Route path="/create-order" element={<ProtectedRoute requiredRoles={['client', 'manager']}><CreateOrder /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute requiredRoles={['client', 'manager']}><Orders /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/queue" element={<ProtectedRoute requiredRoles={['metrolog']}><Queue /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute requiredRoles={['manager']}><Dashboard /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute requiredRoles={['manager']}><Reports /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute requiredRoles={['admin']}><AdminUsers /></ProtectedRoute>} />
          <Route path="/financier" element={<ProtectedRoute requiredRoles={['financier']}><Financier /></ProtectedRoute>} />
          <Route path="/approver" element={<ProtectedRoute requiredRoles={['approver']}><Approver /></ProtectedRoute>} />
          <Route path="/director" element={<ProtectedRoute requiredRoles={['director']}><Director /></ProtectedRoute>} />
          <Route path="/gen-director" element={<ProtectedRoute requiredRoles={['gen_director']}><GenDirector /></ProtectedRoute>} />

          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/403" element={<NotFound code={403} />} />
          <Route path="*" element={<NotFound code={404} />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  const { loadFromStorage } = useAuthStore();
  useEffect(() => { loadFromStorage(); }, []);
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}

export default App;