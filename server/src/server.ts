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
app.set('trust proxy', 1); // Trust reverse proxy to allow secure cookies
app.use(cors(corsOptions));

// Trick express-session into treating Chrome Extension requests as secure over local HTTP
app.use((req, _res, next) => {
  if (req.headers.origin && req.headers.origin.startsWith('chrome-extension://')) {
    req.headers['x-forwarded-proto'] = 'https';
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Chrome Extension cross-origin requests strip SameSite=Lax cookies.
// The extension uses chrome.cookies API to read the cookie and sends it in a custom header.
// We map it back to the cookie object so express-session can authenticate the user seamlessly.
app.use((req, _res, next) => {
  if (req.headers['x-extension-session']) {
    req.cookies['connect.sid'] = req.headers['x-extension-session'];
  }
  next();
});

app.use(sessionMiddleware);

// Dynamically override session cookie for Chrome Extension cross-origin requests
app.use((req, _res, next) => {
  if (req.session && req.headers.origin && req.headers.origin.startsWith('chrome-extension://')) {
    req.session.cookie.sameSite = 'none';
    req.session.cookie.secure = true;
  }
  next();
});

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
