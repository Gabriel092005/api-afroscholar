-- AlterTable
ALTER TABLE "Bolsa" ALTER COLUMN "moeda" SET DEFAULT 'AOA';

-- AlterTable
ALTER TABLE "Novidade" ADD COLUMN     "temInscricao" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NovidadeInscricao" (
    "id" TEXT NOT NULL,
    "novidadeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NovidadeInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NovidadeInscricao_novidadeId_usuarioId_key" ON "NovidadeInscricao"("novidadeId", "usuarioId");

-- AddForeignKey
ALTER TABLE "NovidadeInscricao" ADD CONSTRAINT "NovidadeInscricao_novidadeId_fkey" FOREIGN KEY ("novidadeId") REFERENCES "Novidade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NovidadeInscricao" ADD CONSTRAINT "NovidadeInscricao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
