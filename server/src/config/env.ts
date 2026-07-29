import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  databaseUrl: requireEnv('DATABASE_URL'),
  sessionSecret: requireEnv('SESSION_SECRET'),

  // CLIENT_URL may be comma-separated (e.g. Vercel preview + prod URLs).
  // clientUrls is used for CORS allow-list; clientUrl is the primary redirect target.
  clientUrls: (process.env['CLIENT_URL'] ?? 'http://localhost:5173,http://localhost:4173').split(',').map(u => u.trim()),
  get clientUrl(): string { return this.clientUrls[0]; },

  // The public URL of this backend — required for OAuth callback construction.
  serverUrl: process.env['SERVER_URL'] ?? 'http://localhost:3001',

  // OAuth credentials
  googleClientId: process.env['GOOGLE_CLIENT_ID'] ?? '',
  googleClientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
  githubClientId: process.env['GITHUB_CLIENT_ID'] ?? '',
  githubClientSecret: process.env['GITHUB_CLIENT_SECRET'] ?? '',

  githubToken: process.env['GITHUB_TOKEN'],
};
