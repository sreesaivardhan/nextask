import session from 'express-session';
import { prisma } from '../utils/prisma';

/**
 * PrismaSessionStore — custom express-session Store backed by PostgreSQL.
 *
 * Purpose: sessions survive backend restarts because the session data is
 * persisted in the ExpressSession table, not in Node.js process memory.
 *
 * Flow on every request:
 *   1. express-session reads the signed sid cookie.
 *   2. Calls store.get(sid) — we look up the row in ExpressSession.
 *   3. If found and not expired, the data is attached to req.session.
 *   4. Our auth middleware then reads req.session.sessionId and validates
 *      it against the Prisma Session table (application-level token).
 *
 * On session save (after response):
 *   store.set(sid, sessionData) — upserts the row.
 *
 * On logout:
 *   store.destroy(sid) — deletes the row.
 */
export class PrismaSessionStore extends session.Store {
  private ttl: number;

  constructor(ttl = 7 * 24 * 60 * 60 * 1000) {
    super();
    this.ttl = ttl;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(sid: string, callback: (err: any, session?: session.SessionData | null) => void): void {
    prisma.expressSession
      .findUnique({ where: { sid } })
      .then((stored) => {
        if (!stored) {
          callback(null, null);
          return;
        }
        if (stored.expiresAt < new Date()) {
          prisma.expressSession.delete({ where: { sid } }).catch(() => {});
          callback(null, null);
          return;
        }
        const parsed = JSON.parse(stored.data) as session.SessionData;
        callback(null, parsed);
      })
      .catch((err) => callback(err));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  set(sid: string, sessionData: session.SessionData, callback?: (err?: any) => void): void {
    const maxAge = sessionData.cookie?.maxAge ?? this.ttl;
    const expiresAt = new Date(Date.now() + maxAge);
    const data = JSON.stringify(sessionData);

    prisma.expressSession
      .upsert({
        where: { sid },
        create: { sid, data, expiresAt },
        update: { data, expiresAt },
      })
      .then(() => callback?.())
      .catch((err) => callback?.(err));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  destroy(sid: string, callback?: (err?: any) => void): void {
    prisma.expressSession
      .delete({ where: { sid } })
      .catch(() => {})
      .then(() => callback?.());
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  touch(sid: string, session: session.SessionData, callback?: (err?: any) => void): void {
    const maxAge = session.cookie?.maxAge ?? this.ttl;
    const expiresAt = new Date(Date.now() + maxAge);

    prisma.expressSession
      .update({ where: { sid }, data: { expiresAt } })
      .catch(() => {})
      .then(() => callback?.());
  }
}
