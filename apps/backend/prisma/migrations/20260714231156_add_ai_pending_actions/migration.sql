-- CreateEnum
CREATE TYPE "AiPendingActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'EXECUTING', 'EXECUTED', 'CANCELLED', 'EXPIRED', 'FAILED');

-- CreateEnum
CREATE TYPE "AiPendingActionType" AS ENUM ('SAVE_MATERIAL', 'UNSAVE_MATERIAL', 'SAVE_PROJECT', 'UNSAVE_PROJECT', 'START_PROJECT_BUILD', 'LINK_MATERIAL_TO_BUILD_COMPONENT', 'UNLINK_MATERIAL_FROM_BUILD_COMPONENT', 'PREPARE_MATERIAL_RESERVATION', 'CONFIRM_MATERIAL_RESERVATION', 'CANCEL_PENDING_AI_ACTION');

-- CreateTable
CREATE TABLE "ai_pending_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "source_message_id" TEXT,
    "action_type" "AiPendingActionType" NOT NULL,
    "status" "AiPendingActionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "display_snapshot" JSONB NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "result" JSONB,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_pending_actions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_pending_actions_conversation_id_status_idx" ON "ai_pending_actions"("conversation_id", "status");

-- CreateIndex
CREATE INDEX "ai_pending_actions_expires_at_idx" ON "ai_pending_actions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_pending_actions_user_id_idempotency_key_key" ON "ai_pending_actions"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_pending_actions" ADD CONSTRAINT "ai_pending_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
