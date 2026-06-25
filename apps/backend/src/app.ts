import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { categoriesRouter } from './modules/categories/categories.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { deliveriesRouter } from './modules/deliveries/deliveries.routes.js';
import { driverRouter } from './modules/driver/driver.routes.js';
import { invitationsRouter } from './modules/invitations/invitations.routes.js';
import { learningProjectsRouter } from './modules/learning-projects/learning-projects.routes.js';
import { materialTypesRouter } from './modules/material-types/material-types.routes.js';
import { materialsRouter } from './modules/materials/materials.routes.js';
import { priceRuleRequestsRouter } from './modules/price-rule-requests/price-rule-requests.routes.js';
import { reservationsRouter } from './modules/reservations/reservations.routes.js';
import { supplierRouter } from './modules/supplier/supplier.routes.js';
import { locationsRouter } from './modules/locations/locations.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import {
  ensureMaterialUploadsDir,
  MATERIAL_UPLOADS_DIR,
} from './modules/uploads/uploads.storage.js';

ensureMaterialUploadsDir();

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
app.use('/uploads/materials', express.static(MATERIAL_UPLOADS_DIR));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/material-types', materialTypesRouter);
app.use('/api/price-rule-requests', priceRuleRequestsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/learning-projects', learningProjectsRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/driver', driverRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/supplier', supplierRouter);

app.use(notFoundMiddleware);
app.use(errorMiddleware);
