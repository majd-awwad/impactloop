-- CreateEnum
CREATE TYPE "ProjectHelpSessionStatus" AS ENUM ('PENDING', 'ALTERNATIVE_PROPOSED', 'ZOOM_PENDING', 'SCHEDULING_FAILED', 'SCHEDULED', 'DECLINED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProjectHelpSessionTimeOptionType" AS ENUM ('LEARNER_PROPOSED', 'AUTHOR_ALTERNATIVE');

-- CreateTable
CREATE TABLE "project_help_session_offerings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "allow_15_minutes" BOOLEAN NOT NULL DEFAULT false,
    "allow_30_minutes" BOOLEAN NOT NULL DEFAULT false,
    "weekly_limit" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_help_session_offerings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_help_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "project_step_id" TEXT,
    "problem_description" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "learner_time_zone" TEXT NOT NULL,
    "status" "ProjectHelpSessionStatus" NOT NULL DEFAULT 'PENDING',
    "active_key" TEXT,
    "selected_time_option_id" TEXT,
    "alternative_proposed_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "zoom_meeting_id" TEXT,
    "zoom_join_url" TEXT,
    "zoom_created_at" TIMESTAMP(3),
    "zoom_last_failure_code" TEXT,
    "zoom_last_failure_at" TIMESTAMP(3),
    "declined_reason" TEXT,
    "declined_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancellation_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_help_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_help_session_time_options" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "proposed_by_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "proposal_type" "ProjectHelpSessionTimeOptionType" NOT NULL DEFAULT 'LEARNER_PROPOSED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_help_session_time_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_help_session_status_history" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "from_status" "ProjectHelpSessionStatus",
    "to_status" "ProjectHelpSessionStatus" NOT NULL,
    "actor_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_help_session_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_help_session_offerings_project_id_key" ON "project_help_session_offerings"("project_id");

-- CreateIndex
CREATE INDEX "project_help_session_offerings_author_id_idx" ON "project_help_session_offerings"("author_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_help_sessions_active_key_key" ON "project_help_sessions"("active_key");

-- CreateIndex
CREATE UNIQUE INDEX "project_help_sessions_selected_time_option_id_key" ON "project_help_sessions"("selected_time_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_help_sessions_zoom_meeting_id_key" ON "project_help_sessions"("zoom_meeting_id");

-- CreateIndex
CREATE INDEX "project_help_sessions_learner_id_created_at_idx" ON "project_help_sessions"("learner_id", "created_at");

-- CreateIndex
CREATE INDEX "project_help_sessions_author_id_status_created_at_idx" ON "project_help_sessions"("author_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "project_help_sessions_project_id_idx" ON "project_help_sessions"("project_id");

-- CreateIndex
CREATE INDEX "project_help_sessions_build_id_idx" ON "project_help_sessions"("build_id");

-- CreateIndex
CREATE INDEX "project_help_session_time_options_session_id_starts_at_idx" ON "project_help_session_time_options"("session_id", "starts_at");

-- CreateIndex
CREATE INDEX "project_help_session_status_history_session_id_created_at_idx" ON "project_help_session_status_history"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "project_help_session_offerings" ADD CONSTRAINT "project_help_session_offerings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_session_offerings" ADD CONSTRAINT "project_help_session_offerings_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_project_step_id_fkey" FOREIGN KEY ("project_step_id") REFERENCES "project_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_sessions" ADD CONSTRAINT "project_help_sessions_selected_time_option_id_fkey" FOREIGN KEY ("selected_time_option_id") REFERENCES "project_help_session_time_options"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_session_time_options" ADD CONSTRAINT "project_help_session_time_options_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "project_help_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_session_time_options" ADD CONSTRAINT "project_help_session_time_options_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_session_status_history" ADD CONSTRAINT "project_help_session_status_history_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "project_help_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_help_session_status_history" ADD CONSTRAINT "project_help_session_status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
