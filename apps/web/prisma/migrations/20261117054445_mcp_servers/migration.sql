-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "urlEncrypted" TEXT NOT NULL,
    "urlHost" TEXT NOT NULL,
    "authEncrypted" TEXT NOT NULL DEFAULT '',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpRun" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "response" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_organisationId_name_key" ON "McpServer"("organisationId", "name");

-- CreateIndex
CREATE INDEX "McpRun_serverId_createdAt_idx" ON "McpRun"("serverId", "createdAt");

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpRun" ADD CONSTRAINT "McpRun_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
