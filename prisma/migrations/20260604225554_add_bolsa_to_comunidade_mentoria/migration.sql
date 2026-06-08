-- AlterTable
ALTER TABLE "Community" ADD COLUMN     "bolsaId" TEXT;

-- AlterTable
ALTER TABLE "mentorias" ADD COLUMN     "bolsaId" TEXT;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorias" ADD CONSTRAINT "mentorias_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
