/**
 * Home page - Shows login or redirects to dashboard
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Login from './login.jsx';

export default function Home() {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(state => !!state.auth.token);
  const roles = useSelector(state => state.auth.roles);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Route based on role
    if (roles.includes('admin')) {
      navigate('/dashboard');
    } else {
      navigate('/dashboard');
    }
  }, [isAuthenticated, roles, navigate]);

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">ERP System</h1>
        <p className="text-neutral-600">Redirecting...</p>
      </div>
    </div>
  );
}
