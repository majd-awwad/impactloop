-- CreateTable
CREATE TABLE "handover_code_attempts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_code_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_code_verification_audits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_code_verification_audits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handover_code_attempts_locked_until_idx" ON "handover_code_attempts"("locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "handover_code_attempts_user_id_scope_entity_id_key" ON "handover_code_attempts"("user_id", "scope", "entity_id");

-- CreateIndex
CREATE INDEX "handover_code_verification_audits_user_id_created_at_idx" ON "handover_code_verification_audits"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "handover_code_verification_audits_entity_id_scope_created_at_idx" ON "handover_code_verification_audits"("entity_id", "scope", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "handover_code_attempts" ADD CONSTRAINT "handover_code_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_code_verification_audits" ADD CONSTRAINT "handover_code_verification_audits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
