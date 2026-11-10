-- CreateTable
CREATE TABLE "WorkspaceVoice" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerVoiceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "accent" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "sampleUrl" TEXT,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceUsage" (
    "organisationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "characters" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VoiceUsage_pkey" PRIMARY KEY ("organisationId","day")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceVoice_organisationId_provider_providerVoiceId_key" ON "WorkspaceVoice"("organisationId", "provider", "providerVoiceId");

-- AddForeignKey
ALTER TABLE "WorkspaceVoice" ADD CONSTRAINT "WorkspaceVoice_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceUsage" ADD CONSTRAINT "VoiceUsage_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
