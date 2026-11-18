-- AlterEnum
ALTER TYPE "KnowledgeKind" ADD VALUE 'TEXT';

-- AlterTable
ALTER TABLE "KnowledgeItem" ADD COLUMN     "contentChars" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "error" TEXT;

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeChunk_agentId_idx" ON "KnowledgeChunk"("agentId");

-- CreateIndex
CREATE INDEX "KnowledgeChunk_itemId_position_idx" ON "KnowledgeChunk"("itemId", "position");

-- AddForeignKey
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fast full-text search over knowledge pieces during calls.
CREATE INDEX "KnowledgeChunk_text_search_idx" ON "KnowledgeChunk" USING GIN (to_tsvector('english', "text"));
