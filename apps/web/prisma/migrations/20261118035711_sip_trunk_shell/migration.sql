-- AlterTable
ALTER TABLE "PhoneNumber" ADD COLUMN     "inboundEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "outboundEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SipTrunk" ADD COLUMN     "authMode" TEXT NOT NULL DEFAULT 'credentials',
ADD COLUMN     "direction" TEXT NOT NULL DEFAULT 'both',
ADD COLUMN     "passwordEncrypted" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'other',
ALTER COLUMN "status" SET DEFAULT 'saved';

-- Trunks were only ever simulated as "connected"; until a phone system is connected they are just saved.
UPDATE "SipTrunk" SET "status" = 'saved';
