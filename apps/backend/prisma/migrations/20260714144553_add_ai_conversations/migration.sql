-- CreateEnum
CREATE TYPE "AiConversationMode" AS ENUM ('GENERAL_LEARNING', 'LEARNER_AGENT', 'PROJECT_AUTHORING');

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AiConversationProcessingState" AS ENUM ('IDLE', 'PROCESSING');

-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "AiMessageStatus" AS ENUM ('COMPLETED', 'REFUSED', 'FAILED', 'PROCESSING');

-- CreateEnum
CREATE TYPE "AiScopeClassification" AS ENUM ('DOMAIN_KNOWLEDGE', 'OUT_OF_SCOPE', 'DANGEROUS_REQUEST', 'UNCLEAR', 'MIXED');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "mode" "AiConversationMode" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "processing_state" "AiConversationProcessingState" NOT NULL DEFAULT 'IDLE',
    "processing_started_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "AiMessageRole" NOT NULL,
    "status" "AiMessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "content_text" TEXT,
    "content_blocks" JSONB,
    "client_message_id" TEXT,
    "in_reply_to_message_id" TEXT,
    "scope_classification" "AiScopeClassification",
    "locale" TEXT NOT NULL DEFAULT 'en',
    "provider" TEXT,
    "model" TEXT,
    "policy_version" TEXT,
    "latency_ms" INTEGER,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_status_last_message_at_idx" ON "ai_conversations"("user_id", "status", "last_message_at" DESC);

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_messages_in_reply_to_message_id_idx" ON "ai_messages"("in_reply_to_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_messages_conversation_id_client_message_id_key" ON "ai_messages"("conversation_id", "client_message_id");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_in_reply_to_message_id_fkey" FOREIGN KEY ("in_reply_to_message_id") REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
