-- AlterTable
ALTER TABLE "aulas_online" ADD COLUMN     "bolsaId" TEXT;

-- AddForeignKey
ALTER TABLE "aulas_online" ADD CONSTRAINT "aulas_online_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE SET NULL ON UPDATE CASCADE;
