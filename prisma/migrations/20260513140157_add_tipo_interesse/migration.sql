/*
  Warnings:

  - Added the required column `titulo` to the `Notification` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TipoInteresse" AS ENUM ('CONSULTORIA', 'MENTORIA', 'INSCRICAO');

-- CreateEnum
CREATE TYPE "DepoimentoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "JoinStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO');

-- AlterTable
ALTER TABLE "Bolsa" ALTER COLUMN "categoria" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BolsaInscricao" ADD COLUMN     "tipoInteresse" "TipoInteresse";

-- AlterTable
ALTER TABLE "CommunityMember" ADD COLUMN     "status" "JoinStatus" NOT NULL DEFAULT 'APROVADO';

-- AlterTable
ALTER TABLE "Curso" ALTER COLUMN "categoria" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "entidade" TEXT,
ADD COLUMN     "entidadeId" TEXT,
ADD COLUMN     "link" TEXT,
ADD COLUMN     "tipo" TEXT NOT NULL DEFAULT 'INFO',
ADD COLUMN     "titulo" TEXT NOT NULL,
ADD COLUMN     "visualizada" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Depoimento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "curso" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "imagem" TEXT,
    "usuarioId" TEXT,
    "status" "DepoimentoStatus" NOT NULL DEFAULT 'PUBLICADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Depoimento_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Depoimento" ADD CONSTRAINT "Depoimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
