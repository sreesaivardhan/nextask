import cors from 'cors';
import { env } from './env';

export const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (env.clientUrls.includes(origin)) return callback(null, true);
    if (origin.startsWith('chrome-extension://')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Extension-Session', 'X-Socket-Id'],
};
