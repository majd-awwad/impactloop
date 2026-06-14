import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { healthRouter } from './modules/health/health.routes.js';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
  }),
);
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
