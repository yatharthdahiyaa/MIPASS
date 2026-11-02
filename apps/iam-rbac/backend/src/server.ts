import { createApp } from './app';
import { env } from './config/env';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`
  ======================================================
  🚀 AWS Console IAM RBAC Backend Server Running!
  ======================================================
  • Port:        ${env.PORT}
  • Environment: ${env.NODE_ENV}
  • Client URL:  ${env.CLIENT_URL}
  • Health:      http://localhost:${env.PORT}/health
  • API Prefix:  http://localhost:${env.PORT}/api/v1
  ======================================================
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
