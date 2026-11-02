import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';

export function createApp(): Express {
  const app = express();

  // 1. Security Headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows cross-origin API calls from SPA
      crossOriginEmbedderPolicy: false,
    })
  );

  // 2. Strict CORS
  app.use(
    cors({
      origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Body & Cookie Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // 4. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'aws-iam-rbac-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Mount API Routes
  app.use('/api/v1', routes);
  app.use('/', routes); // Also mounts /auth, /users directly for convenience

  // 6. Global Error Handler
  app.use(errorHandler);

  return app;
}
