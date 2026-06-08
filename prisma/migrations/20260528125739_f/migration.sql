/*
  Warnings:

  - A unique constraint covering the columns `[resetToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ACCOUNT_STATUS" AS ENUM ('ACTIVA', 'DESATIVADA', 'PENDENTE', 'SUSPENSA');

-- CreateEnum
CREATE TYPE "TRANSACTION_STATUS" AS ENUM ('PENDENTE', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "BOT_STATE" AS ENUM ('APRESENTACAO', 'TRABALHANDO', 'REPOUSANDO', 'CONVERSANDO', 'RELAXANDO');

-- CreateEnum
CREATE TYPE "SUBS_STATUS" AS ENUM ('PENDENTE', 'APROVADO', 'CANCELADO', 'EXPIRADA', 'AGUARDANDO_APROVACAO', 'REJEITADO', 'ACTIVA');

-- CreateEnum
CREATE TYPE "AulaOnlineStatus" AS ENUM ('AGENDADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA');

-- DropForeignKey
ALTER TABLE "BolsaInscricao" DROP CONSTRAINT "BolsaInscricao_bolsaId_fkey";

-- DropForeignKey
ALTER TABLE "CursoPagamento" DROP CONSTRAINT "CursoPagamento_cursoId_fkey";

-- DropForeignKey
ALTER TABLE "CursoUsuario" DROP CONSTRAINT "CursoUsuario_cursoId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "palavraPasse" TEXT NOT NULL,
    "image_path" TEXT,
    "role" "Role" NOT NULL DEFAULT 'GESTOR',
    "estado_conta" "ACCOUNT_STATUS" NOT NULL DEFAULT 'ACTIVA',
    "pushSubscription" TEXT,
    "fcm_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificacao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'INFO',
    "link" TEXT,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "visualizada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "website" TEXT,
    "logotipo" TEXT,
    "cor_primaria" TEXT,
    "descricao" TEXT,
    "contacto" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,

    CONSTRAINT "departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "funcao" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "preco_mensal" DECIMAL(10,2) NOT NULL,
    "custo_api_est" DECIMAL(10,2) NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'ON',
    "avatar_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_asset" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "estado" "BOT_STATE" NOT NULL,
    "video_path" TEXT NOT NULL,
    "file_size" INTEGER,
    "mime_type" TEXT DEFAULT 'video/mp4',

    CONSTRAINT "bot_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bot_empresa" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "data_contrato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ACCOUNT_STATUS" NOT NULL DEFAULT 'ACTIVA',

    CONSTRAINT "bot_empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "folha_bot" (
    "id" TEXT NOT NULL,
    "botEmpresaId" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "custo_api_real" DECIMAL(10,2) NOT NULL,
    "valor_cobrado" DECIMAL(10,2) NOT NULL,
    "horas_uso" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "folha_bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacao" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "metodo" TEXT NOT NULL,
    "status" "TRANSACTION_STATUS" NOT NULL DEFAULT 'PENDENTE',
    "referencia" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivo" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" TEXT NOT NULL,

    CONSTRAINT "arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assinatura" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "valorContrato" DECIMAL(10,2) NOT NULL,
    "status" "SUBS_STATUS" NOT NULL DEFAULT 'PENDENTE',
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "dataContratacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataExpiracao" TIMESTAMP(3) NOT NULL,
    "metodoPagamento" TEXT,

    CONSTRAINT "assinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrinho_item" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "departamentoId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carrinho_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comentario" TEXT,
    "nome_exibicao" TEXT,
    "cargo_exibicao" TEXT,
    "usuarioId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagem" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sender" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "botEmpresaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "value" TEXT,
    "iban" TEXT,
    "Banco" TEXT,
    "empresaId" TEXT,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "what_bot_can_do" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "what_bot_can_do_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "what_bot_can_not_do" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "what_bot_can_not_do_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfilAcademico" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nivelEnsino" TEXT NOT NULL,
    "instituicao" TEXT,
    "curso" TEXT,
    "anoConclusao" TEXT,
    "media" TEXT,
    "pais" TEXT,
    "idiomas" TEXT,
    "biUrl" TEXT,
    "curriculumUrl" TEXT,
    "fotoUrl" TEXT,
    "dataNascimento" TEXT,
    "provincia" TEXT,
    "municipio" TEXT,
    "motivacoes" TEXT,
    "experienciaProfissional" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerfilAcademico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnaliseDocumento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "tipoDocumento" TEXT NOT NULL,
    "areaPretendida" TEXT NOT NULL,
    "observacao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "feedback" TEXT,
    "arquivoUrl" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnaliseDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas_online" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "duracao" INTEGER,
    "roomId" TEXT NOT NULL,
    "status" "AulaOnlineStatus" NOT NULL DEFAULT 'AGENDADA',
    "gravacaoUrl" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "hostId" TEXT NOT NULL,
    "mentoriaId" TEXT,

    CONSTRAINT "aulas_online_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aulas_online_participantes" (
    "id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aulaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "aulas_online_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorias" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mentorias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentorias_inscricoes" (
    "id" TEXT NOT NULL,
    "mentoriaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "status" "InscricaoStatus" NOT NULL DEFAULT 'PENDENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentorias_inscricoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "transacao_referencia_key" ON "transacao"("referencia");

-- CreateIndex
CREATE UNIQUE INDEX "setting_slug_key" ON "setting"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "PerfilAcademico_usuarioId_key" ON "PerfilAcademico"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_online_roomId_key" ON "aulas_online"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_online_participantes_aulaId_usuarioId_key" ON "aulas_online_participantes"("aulaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "mentorias_inscricoes_mentoriaId_usuarioId_key" ON "mentorias_inscricoes"("mentoriaId", "usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "User_resetToken_key" ON "User"("resetToken");

-- AddForeignKey
ALTER TABLE "notificacao" ADD CONSTRAINT "notificacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empresa" ADD CONSTRAINT "empresa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departamento" ADD CONSTRAINT "departamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_asset" ADD CONSTRAINT "bot_asset_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_empresa" ADD CONSTRAINT "bot_empresa_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_empresa" ADD CONSTRAINT "bot_empresa_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bot_empresa" ADD CONSTRAINT "bot_empresa_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "folha_bot" ADD CONSTRAINT "folha_bot_botEmpresaId_fkey" FOREIGN KEY ("botEmpresaId") REFERENCES "bot_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacao" ADD CONSTRAINT "transacao_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assinatura" ADD CONSTRAINT "assinatura_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrinho_item" ADD CONSTRAINT "carrinho_item_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrinho_item" ADD CONSTRAINT "carrinho_item_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrinho_item" ADD CONSTRAINT "carrinho_item_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carrinho_item" ADD CONSTRAINT "carrinho_item_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "departamento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_botEmpresaId_fkey" FOREIGN KEY ("botEmpresaId") REFERENCES "bot_empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "setting_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "empresa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "what_bot_can_do" ADD CONSTRAINT "what_bot_can_do_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "what_bot_can_not_do" ADD CONSTRAINT "what_bot_can_not_do_botId_fkey" FOREIGN KEY ("botId") REFERENCES "bot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BolsaInscricao" ADD CONSTRAINT "BolsaInscricao_bolsaId_fkey" FOREIGN KEY ("bolsaId") REFERENCES "Bolsa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoPagamento" ADD CONSTRAINT "CursoPagamento_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CursoUsuario" ADD CONSTRAINT "CursoUsuario_cursoId_fkey" FOREIGN KEY ("cursoId") REFERENCES "Curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerfilAcademico" ADD CONSTRAINT "PerfilAcademico_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnaliseDocumento" ADD CONSTRAINT "AnaliseDocumento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_online" ADD CONSTRAINT "aulas_online_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_online" ADD CONSTRAINT "aulas_online_mentoriaId_fkey" FOREIGN KEY ("mentoriaId") REFERENCES "mentorias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_online_participantes" ADD CONSTRAINT "aulas_online_participantes_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "aulas_online"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aulas_online_participantes" ADD CONSTRAINT "aulas_online_participantes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorias_inscricoes" ADD CONSTRAINT "mentorias_inscricoes_mentoriaId_fkey" FOREIGN KEY ("mentoriaId") REFERENCES "mentorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentorias_inscricoes" ADD CONSTRAINT "mentorias_inscricoes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
