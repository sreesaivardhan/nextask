import session from 'express-session';
import { env } from './env';
import { PrismaSessionStore } from './sessionStore';

const store = new PrismaSessionStore(7 * 24 * 60 * 60 * 1000);

export const sessionOptions: session.SessionOptions = {
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store,
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: env.nodeEnv === 'production' ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
};

export const sessionMiddleware = session(sessionOptions);
