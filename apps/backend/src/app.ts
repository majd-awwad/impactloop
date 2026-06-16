import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';
import { supplierRouter } from './modules/supplier/supplier.routes.js';

export const app = express();

const isProduction = env.nodeEnv === 'production';

app.use(
  helmet({
    crossOriginResourcePolicy: isProduction ? { policy: 'same-origin' } : false,
  }),
);
app.use(
  cors({
    origin: isProduction
      ? env.corsOrigins.length > 0
        ? env.corsOrigins
        : false
      : true,
    credentials: true,
  }),
);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/supplier', supplierRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
