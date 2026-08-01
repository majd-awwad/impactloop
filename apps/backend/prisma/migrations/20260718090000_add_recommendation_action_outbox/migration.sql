-- Durable recommendation action delivery is additive. Previously applied
-- recommendation migrations are intentionally not modified.

ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'MATERIAL_UNLIKE';
ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'RESERVATION_CREATED';
ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'PROJECT_UNLIKE';
ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'PROJECT_UNSAVE';
ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'PROJECT_UNFOLLOW';
ALTER TYPE "RecommendationActionType" ADD VALUE IF NOT EXISTS 'PROJECT_BUILD_PROGRESS_UPDATED';
ALTER TYPE "RecommendationOutboxEventKind" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_ACTION';
