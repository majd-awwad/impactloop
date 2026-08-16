import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorMiddleware } from './middlewares/error.middleware.js';
import { notFoundMiddleware } from './middlewares/not-found.middleware.js';
import { requestContextMiddleware } from './middlewares/request-context.middleware.js';
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
import { adminRouter } from './modules/admin/admin.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { publicSuppliersRouter } from './modules/public-suppliers/public-suppliers.routes.js';
import { publicUsersRouter } from './modules/public-users/public-users.routes.js';
import { supplierRouter } from './modules/supplier/supplier.routes.js';
import { supplierMaterialRequestsRouter } from './modules/supplier-material-requests/supplier-material-requests.routes.js';
import { locationsRouter } from './modules/locations/locations.routes.js';
import { savedDropoffAddressesRouter } from './modules/saved-dropoff-addresses/saved-dropoff-addresses.routes.js';
import { profileRouter } from './modules/profile/profile.routes.js';
import { learnerHomeRouter } from './modules/learner-home/learner-home.routes.js';
import { learnerMaterialRequestsRouter } from './modules/learner-material-requests/learner-material-requests.routes.js';
import { learnerProfileSummaryRouter } from './modules/learner-profile-summary/learner-profile-summary.routes.js';
import { learnerBuildsRouter } from './modules/learner-builds/learner-builds.routes.js';
import { projectHelpSessionsRouter } from './modules/project-help-sessions/project-help-session-sessions.routes.js';
import { aiRouter } from './modules/ai/ai.routes.js';
import {
  bindRecommendationEventOriginMiddleware,
  type WritableRecommendationEventSource,
} from './modules/recommendation-events/recommendation-event-origin.js';
import { recommendationActionAttributionMiddleware } from './modules/recommendation-events/recommendation-events.service.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import {
  paymentsCheckoutRouter,
  paymentsMockWebhookRouter,
} from './modules/payments/payments.checkout-routes.js';
import { isCardCheckoutProductEnabled } from './modules/payments/payments.product-policy.js';
import { COMMUNITY_DEMO_MATERIALS_SOURCE_IMAGES_DIR } from './constants/community-demo-materials.js';
import { COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR } from './constants/community-demo-projects.js';
import { DEMO_VISUAL_ASSETS_DIR } from './constants/demo-visual-assets.js';
import {
  ensureMaterialUploadsDir,
  MATERIAL_UPLOADS_DIR,
} from './modules/uploads/uploads.storage.js';
import {
  ensureProfileUploadsDir,
  PROFILE_UPLOADS_DIR,
} from './modules/uploads/profile-uploads.storage.js';
import {
  ensureSupplierVerificationUploadsDir,
} from './modules/uploads/verification-uploads.storage.js';
import {
  ensureBuildCompletionUploadsDir,
} from './modules/learning-projects/build-completion-uploads.storage.js';
import { ensureUploadTempDir } from './modules/uploads/secure-upload.js';

ensureMaterialUploadsDir();
ensureProfileUploadsDir();
ensureSupplierVerificationUploadsDir();
ensureBuildCompletionUploadsDir();
ensureUploadTempDir();

export type CreateAppOptions = {
  recommendationEventOrigin: WritableRecommendationEventSource;
};

export const createApp = (options: CreateAppOptions): Express => {
  const app = express();
  const isProduction = env.nodeEnv === 'production';

  app.set('trust proxy', env.trustProxy);

  app.use(requestContextMiddleware);
  app.use(
    bindRecommendationEventOriginMiddleware(options.recommendationEventOrigin),
  );
  app.use(
    helmet({
      crossOriginResourcePolicy: isProduction
        ? { policy: 'same-origin' }
        : false,
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
      exposedHeaders: ['X-Request-Id'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control',
        'X-Request-Id',
        'X-Client-Platform',
        'Idempotency-Key',
        'X-Recommendation-Impression-Id',
      ],
    }),
  );
  app.use('/uploads/materials', express.static(MATERIAL_UPLOADS_DIR));
  app.use('/uploads/profiles', express.static(PROFILE_UPLOADS_DIR));
  // Local community demo originals (relative URLs; client resolves via API base).
  app.use(
    '/demo-assets/community-materials',
    express.static(COMMUNITY_DEMO_MATERIALS_SOURCE_IMAGES_DIR),
  );
  app.use(
    '/demo-assets/community-projects',
    express.static(COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR),
  );
  app.use(
    '/demo-assets/visual-assets',
    express.static(DEMO_VISUAL_ASSETS_DIR),
  );
  // Supplier verification documents and build-completion photos are private —
  // never serve via anonymous express.static. Use authenticated download endpoints.
  // Mock payment webhook requires raw body — mounted only when card checkout product policy is on.
  if (env.paymentMockRoutesEnabled && isCardCheckoutProductEnabled()) {
    app.use(
      '/api/payments/webhooks/mock',
      express.raw({ type: 'application/json' }),
      paymentsMockWebhookRouter,
    );
  }
  app.use(express.json());
  app.use(recommendationActionAttributionMiddleware);

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/profile', profileRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/material-types', materialTypesRouter);
  app.use('/api/price-rule-requests', priceRuleRequestsRouter);
  app.use('/api/invitations', invitationsRouter);
  app.use('/api/learning-projects', learningProjectsRouter);
  app.use('/api/materials', materialsRouter);
  app.use('/api/reservations', reservationsRouter);
  app.use('/api/payments', paymentsRouter);
  if (isCardCheckoutProductEnabled()) {
    app.use('/api/payments', paymentsCheckoutRouter);
  }
  app.use('/api/deliveries', deliveriesRouter);
  app.use('/api/driver', driverRouter);
  app.use('/api/uploads', uploadsRouter);
  app.use('/api/locations', locationsRouter);
  app.use(
    '/api/learner/saved-dropoff-addresses',
    savedDropoffAddressesRouter,
  );
  app.use('/api/learner/material-requests', learnerMaterialRequestsRouter);
  app.use('/api/learner', learnerHomeRouter);
  app.use('/api/learner', learnerProfileSummaryRouter);
  app.use('/api/learner', learnerBuildsRouter);
  app.use('/api/project-help-sessions', projectHelpSessionsRouter);
  app.use('/api/ai/v1', aiRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/suppliers', publicSuppliersRouter);
  app.use('/api/users', publicUsersRouter);
  app.use('/api/supplier/material-requests', supplierMaterialRequestsRouter);
  app.use('/api/supplier', supplierRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

/** Production singleton — trusted recommendation event origin is REAL. */
export const app = createApp({ recommendationEventOrigin: 'REAL' });
