-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'GESTOR', 'USUARIO');

-- CreateEnum
CREATE TYPE "EstadoConta" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "BolsaStatus" AS ENUM ('RASCUNHO', 'PUBLICADA', 'INATIVA');

-- CreateEnum
CREATE TYPE "InscricaoStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "CursoStatus" AS ENUM ('RASCUNHO', 'PUBLICADO');

-- CreateEnum
CREATE TYPE "AulaTipo" AS ENUM ('VIDEO', 'PDF', 'QUIZ');

-- CreateEnum
CREATE TYPE "PagamentoStatus" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USUARIO',
    "estado_conta" "EstadoConta" NOT NULL DEFAULT 'ACTIVA',
    "image_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bolsa" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "categoria" TEXT NOT NULL,
    "instituicao" TEXT,
    "pais" TEXT,
    "nivel" TEXT,
    "requisitos" TEXT,
    "valor" DOUBLE PRECISION NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'USD',
    "precoOriginal" DOUBLE PRECISION,
    "idioma" TEXT,
    "tags" TEXT[],
    "descricao" TEXT,
    "imagemUrl" TEXT,
    "linkAplicar" TEXT,
    "prazo" TIMESTAMP(3),
    "numeroVagas" INTEGER,
    "status" "BolsaStatus" NOT NULL DEFAULT 'RASCUNHO',
    "modalidade" TEXT,
    "imagemBg" TEXT,
    "datasImportantes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bolsa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BolsaInscricao" (
    "id" TEXT NOT NULL,
    "bolsaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "InscricaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BolsaInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Curso" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "subtitulo" TEXT,
    "categoria" TEXT NOT NULL,
    "nivel" TEXT,
    "duracao" TEXT,
    "quantAulas" INTEGER NOT NULL DEFAULT 0,
    "estudantes" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "preco" DOUBLE PRECISION NOT NULL,
    "precoOriginal" DOUBLE PRECISION,
    "idioma" TEXT,
    "tags" TEXT[],
    "descricao" TEXT,
    "capaUrl" TEXT,
    "status" "CursoStatus" NOT NULL DEFAULT 'RASCUNHO',
    "mentorNome" TEXT,
    "mentorAvatar" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Aula" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "tipo" "AulaTipo" NOT NULL,
    "duracao" TEXT,
    "ordem" INTEGER NOT NULL,
    "gratuito" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "videoLocal" TEXT,
    "pdfUrl" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoPagamento" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "valor" DOUBLE PRECISION NOT NULL,
    "metodo" TEXT,
    "referencia" TEXT,
    "status" "PagamentoStatus" NOT NULL DEFAULT 'PENDENTE',
    "comprovativo" TEXT,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CursoPagamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CursoUsuario" (
    "id" TEXT NOT NULL,
    "cursoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CursoUsuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BolsaInscricao_bolsaId_usuarioId_key" ON "BolsaInscricao"("bolsaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "CursoUsuario_cursoId_usuarioId_key" ON "CursoUsuario"("cursoId", "usuarioId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolsaInscricao" ADD CONSTRAINT "BolsaInscricao_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolsaInscricao" ADD CONSTRAINT "BolsaInscricao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Aula" ADD CONSTRAINT "Aula_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoPagamento" ADD CONSTRAINT "CursoPagamento_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoPagamento" ADD CONSTRAINT "CursoPagamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoUsuario" ADD CONSTRAINT "CursoUsuario_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoUsuario" ADD CONSTRAINT "CursoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
