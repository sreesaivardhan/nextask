import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { corsOptions } from './config/cors';
import { sessionMiddleware } from './config/session';
import { logger } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import { apiRouter } from './routes/index';
import { initializeSocket } from './socket/index';

const app = express();
const httpServer = http.createServer(app);

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(logger);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', apiRouter);
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Socket.io ────────────────────────────────────────────────────────────────
initializeSocket(httpServer);

import { startAIScheduler } from './scheduler';

// ─── Start ────────────────────────────────────────────────────────────────────
httpServer.listen(env.port, () => {
  console.log(`[Server] NexTask server running on port ${env.port} (${env.nodeEnv})`);
  console.log(`[Server] Health: http://localhost:${env.port}/health`);
  
  // Start background tasks
  startAIScheduler();
});

export { app };
