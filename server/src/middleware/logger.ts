import morgan from 'morgan';
import { env } from '../config/env';

export const logger = morgan(env.nodeEnv === 'production' ? 'combined' : 'dev');
