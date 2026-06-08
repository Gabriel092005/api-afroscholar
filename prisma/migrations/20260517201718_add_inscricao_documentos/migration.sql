-- CreateTable
CREATE TABLE "NovidadeInscricaoDocumento" (
    "id" TEXT NOT NULL,
    "inscricaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NovidadeInscricaoDocumento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "NovidadeInscricaoDocumento" ADD CONSTRAINT "NovidadeInscricaoDocumento_inscricaoId_fkey" FOREIGN KEY ("inscricaoId") REFERENCES "NovidadeInscricao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
