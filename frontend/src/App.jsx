import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AppLayout } from './components/common/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { OrdersPage } from './pages/OrdersPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { IncidentDetailPage } from './pages/IncidentDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoadingState } from './components/common/LoadingState';

// Customer Portal Pages
import { CustomerPortalLayout } from './pages/portal/CustomerPortalLayout';
import { CustomerOverviewPage } from './pages/portal/CustomerOverviewPage';
import { CustomerInvoicesPage } from './pages/portal/CustomerInvoicesPage';
import { CustomerTransactionsPage } from './pages/portal/CustomerTransactionsPage';
import { CustomerRefundsPage } from './pages/portal/CustomerRefundsPage';
import { CustomerSupportPage } from './pages/portal/CustomerSupportPage';

/**
 * Route protection for Business Portal (Business Admin & Analyst)
 * Prevents Customers from accessing business analytics, reconciliation, internal incidents
 */
function BusinessRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Authenticating business session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'customer') {
    return <Navigate to="/portal" replace />;
  }

  return children;
}

/**
 * Route protection for Customer Portal
 * Prevents Business users from confusing customer invoice view with business admin view
 */
function CustomerRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Authenticating customer portal session..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login?role=customer" replace />;
  }

  if (user?.role !== 'customer') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Public authentication routes (Login, Register)
 * Redirects already-authenticated users to their appropriate portal
 */
function PublicRoute({ children }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Checking session..." />;
  }

  if (isAuthenticated) {
    if (user?.role === 'customer') {
      return <Navigate to="/portal" replace />;
    }
    if (user?.role === 'analyst') {
      return <Navigate to="/reconciliation" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Root index route resolver
 */
function RootIndexResolver() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Loading..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role === 'customer') {
    return <Navigate to="/portal" replace />;
  }

  if (user?.role === 'analyst') {
    return <Navigate to="/reconciliation" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Authentication Routes */}
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <RegisterPage />
                </PublicRoute>
              }
            />

            {/* Root index redirect based on role */}
            <Route path="/" element={<RootIndexResolver />} />

            {/* Business Management & Operations (Admin / Analyst) */}
            <Route
              element={
                <BusinessRoute>
                  <AppLayout />
                </BusinessRoute>
              }
            >
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="reconciliation" element={<ReconciliationPage />} />
              <Route path="incidents" element={<IncidentsPage />} />
              <Route path="incidents/:id" element={<IncidentDetailPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="transactions" element={<TransactionsPage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>

            {/* Customer Self-Service Portal */}
            <Route
              path="/portal"
              element={
                <CustomerRoute>
                  <CustomerPortalLayout />
                </CustomerRoute>
              }
            >
              <Route index element={<CustomerOverviewPage />} />
              <Route path="invoices" element={<CustomerInvoicesPage />} />
              <Route path="transactions" element={<CustomerTransactionsPage />} />
              <Route path="refunds" element={<CustomerRefundsPage />} />
              <Route path="support" element={<CustomerSupportPage />} />
            </Route>

            {/* Catch-all 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
