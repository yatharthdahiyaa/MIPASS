import type { Metadata } from 'next';
import { Suspense } from 'react';
import LoginPage from '@/components/login/LoginPage';

export const metadata: Metadata = {
  title: 'MiPAAS · Secure Login',
  description:
    'Authenticate to access the MiPAAS AI clinical imaging platform. Role-based access control for healthcare professionals.',
};

function LoginFallback() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#050A10',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#EAF2F6',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: '#00DCCE',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: '#7B8FA0', fontSize: 14 }}>Initializing secure session...</p>
      </div>
    </div>
  );
}

export default function LoginRoute() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginPage />
    </Suspense>
  );
}
