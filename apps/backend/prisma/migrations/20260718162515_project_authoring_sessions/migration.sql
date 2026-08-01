-- CreateEnum
CREATE TYPE "ProjectAuthoringSessionStage" AS ENUM ('OVERVIEW', 'TITLE', 'SHORT_DESCRIPTION', 'FULL_DESCRIPTION', 'DIFFICULTY', 'ESTIMATED_DURATION', 'COMPONENTS', 'STEPS_OVERVIEW', 'STEP_REVIEW', 'FINAL_REVIEW', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ProjectAuthoringSessionStatus" AS ENUM ('WAITING_FOR_ASSISTANT', 'WAITING_FOR_USER', 'SAVING', 'GENERATION_FAILED', 'STALE', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ProjectAuthoringTurnStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectAuthoringTurnKind" AS ENUM ('STAGE_PROPOSAL', 'COMPONENT_LIST', 'COMPONENT_ITEM', 'STEP_PLAN', 'STEP_ITEM', 'FOLLOW_UP_QUESTION', 'EXPLANATION', 'MANUAL_VALUE_PREVIEW');

-- CreateTable
CREATE TABLE "project_authoring_sessions" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "learning_project_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "stage" "ProjectAuthoringSessionStage" NOT NULL,
    "status" "ProjectAuthoringSessionStatus" NOT NULL,
    "current_turn_id" TEXT,
    "base_project_updated_at" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "completed_stages" "ProjectAuthoringSessionStage"[] DEFAULT ARRAY[]::"ProjectAuthoringSessionStage"[],
    "component_review_mode" TEXT,
    "component_working_state" JSONB,
    "step_review_mode" TEXT,
    "step_working_state" JSONB,
    "generation_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_authoring_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_authoring_turns" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "parent_turn_id" TEXT,
    "trigger_user_message_id" TEXT,
    "stage" "ProjectAuthoringSessionStage" NOT NULL,
    "kind" "ProjectAuthoringTurnKind" NOT NULL,
    "status" "ProjectAuthoringTurnStatus" NOT NULL,
    "payload" JSONB NOT NULL,
    "explanation" TEXT,
    "base_project_updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "project_authoring_turns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_authoring_sessions_conversation_id_key" ON "project_authoring_sessions"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_authoring_sessions_current_turn_id_key" ON "project_authoring_sessions"("current_turn_id");

-- CreateIndex
CREATE INDEX "project_authoring_sessions_learning_project_id_idx" ON "project_authoring_sessions"("learning_project_id");

-- CreateIndex
CREATE INDEX "project_authoring_sessions_owner_id_idx" ON "project_authoring_sessions"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_authoring_sessions_learning_project_id_key" ON "project_authoring_sessions"("learning_project_id");

-- CreateIndex
CREATE INDEX "project_authoring_turns_session_id_created_at_idx" ON "project_authoring_turns"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "project_authoring_turns_session_id_status_idx" ON "project_authoring_turns"("session_id", "status");

-- AddForeignKey
ALTER TABLE "project_authoring_sessions" ADD CONSTRAINT "project_authoring_sessions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_authoring_sessions" ADD CONSTRAINT "project_authoring_sessions_learning_project_id_fkey" FOREIGN KEY ("learning_project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_authoring_sessions" ADD CONSTRAINT "project_authoring_sessions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_authoring_sessions" ADD CONSTRAINT "project_authoring_sessions_current_turn_id_fkey" FOREIGN KEY ("current_turn_id") REFERENCES "project_authoring_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_authoring_turns" ADD CONSTRAINT "project_authoring_turns_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "project_authoring_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_authoring_turns" ADD CONSTRAINT "project_authoring_turns_parent_turn_id_fkey" FOREIGN KEY ("parent_turn_id") REFERENCES "project_authoring_turns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
