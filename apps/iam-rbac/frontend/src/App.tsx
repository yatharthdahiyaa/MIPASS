import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';

// Auth Pages
import { SignUpPage } from './pages/auth/SignUpPage';
import { SignInStep1Page } from './pages/auth/SignInStep1Page';
import { SignInStep2Page } from './pages/auth/SignInStep2Page';
import { MfaPromptPage } from './pages/auth/MfaPromptPage';
import { VerifyEmailPage } from './pages/auth/VerifyEmailPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/auth/ResetPasswordPage';

// Console & IAM Pages
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { AccessDeniedPage } from './pages/dashboard/AccessDeniedPage';
import { UsersPage } from './pages/iam/UsersPage';
import { RolesPage } from './pages/iam/RolesPage';
import { PoliciesPage } from './pages/iam/PoliciesPage';
import { GroupsPage } from './pages/iam/GroupsPage';
import { AuditLogsPage } from './pages/iam/AuditLogsPage';

function RootRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-aws-lightbg dark:bg-aws-darkBg">
        <div className="w-8 h-8 border-4 border-aws-orange border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? '/dashboard' : '/signin'} replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Authentication Routes */}
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/signin" element={<SignInStep1Page />} />
        <Route path="/signin/step2" element={<SignInStep2Page />} />
        <Route path="/signin/mfa" element={<MfaPromptPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Authenticated Management Console Routes */}
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/access-denied" element={<AccessDeniedPage />} />

          {/* IAM Routes Protected with Granular RBAC Permissions */}
          <Route
            path="/users"
            element={
              <ProtectedRoute permission="users:read">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/roles"
            element={
              <ProtectedRoute permission="roles:read">
                <RolesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/policies"
            element={
              <ProtectedRoute permission="policies:read">
                <PoliciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute permission="groups:read">
                <GroupsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute permission="audit:read">
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Root Redirect & 404 Fallback */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
