import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import routes from './routes';
import { errorHandler } from './middlewares/error.middleware';
import { AppError } from './utils/AppError';
import { defaultRateLimit } from './middlewares/rate-limit.middleware';
import { expirePendingOrders } from './services/order.service';

dotenv.config();
const DEFAULT_PROD_CORS_ORIGINS = 'https://sc.y-98.cn';

function parseCorsOrigins(raw: unknown): string[] {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter((item) => Boolean(item));
}

function getCorsOriginsRaw(): string {
  if (process.env.CORS_ORIGINS) return String(process.env.CORS_ORIGINS);
  if (process.env.NODE_ENV === 'production') return DEFAULT_PROD_CORS_ORIGINS;
  return '';
}

function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  if (!jwtSecret || jwtSecret.length < 16 || /dev_secret_key|please_change_me|change_this_in_production/i.test(jwtSecret)) {
    throw new Error('JWT_SECRET is not properly configured for production.');
  }

  const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
  if (!adminPassword || /admin123|change_this_password/i.test(adminPassword) || adminPassword.length < 10) {
    throw new Error('ADMIN_PASSWORD is not properly configured for production.');
  }

  const corsOrigins = parseCorsOrigins(getCorsOriginsRaw());
  if (corsOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must be configured for production (comma-separated origins).');
  }
}

assertProductionConfig();

const app = express();
const PORT = Number(process.env.PORT || 3001);

const corsOrigins = parseCorsOrigins(getCorsOriginsRaw());
const isProd = process.env.NODE_ENV === 'production';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (no Origin header).
      if (!origin) return callback(null, true);

      // Dev default: allow all.
      if (!isProd && corsOrigins.length === 0) {
        return callback(null, true);
      }

      // Prod default: allow only configured origins.
      if (corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true
  })
);

app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use(defaultRateLimit);

app.use('/api', routes);

app.all('*', (req, _res, next) => {
  next(new AppError(404, `Route ${req.originalUrl} not found`, 404));
});

app.use(errorHandler);

setInterval(() => {
  expirePendingOrders().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[expirePendingOrders]', error);
  });
}, 60 * 1000);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gem Oratopia Backend (TS) running at http://localhost:${PORT}`);
});

