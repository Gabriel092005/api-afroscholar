-- CreateTable
CREATE TABLE "BolsaInscricaoDocumento" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BolsaInscricaoDocumento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BolsaInscricaoDocumento" ADD CONSTRAINT "BolsaInscricaoDocumento_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "BolsaInscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
