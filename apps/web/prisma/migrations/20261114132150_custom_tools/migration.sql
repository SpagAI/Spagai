-- CreateTable
CREATE TABLE "Tool" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'POST',
    "headers" JSONB NOT NULL,
    "sendContext" JSONB NOT NULL,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "waitMessage" TEXT NOT NULL DEFAULT '',
    "signingSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolRun" (
    "id" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "agentId" TEXT,
    "source" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "status" INTEGER,
    "ok" BOOLEAN NOT NULL,
    "response" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tool_organisationId_name_key" ON "Tool"("organisationId", "name");

-- CreateIndex
CREATE INDEX "ToolRun_toolId_createdAt_idx" ON "ToolRun"("toolId", "createdAt");

-- AddForeignKey
ALTER TABLE "Tool" ADD CONSTRAINT "Tool_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolRun" ADD CONSTRAINT "ToolRun_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "Tool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
