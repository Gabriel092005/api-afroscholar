-- CreateTable
CREATE TABLE "comunidade_duvida" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "comunidadeId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "comunidade_duvida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunidade_resposta" (
    "id" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "duvidaId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,

    CONSTRAINT "comunidade_resposta_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "comunidade_duvida" ADD CONSTRAINT "comunidade_duvida_comunidadeId_fkey" FOREIGN KEY ("comunidadeId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidade_duvida" ADD CONSTRAINT "comunidade_duvida_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidade_resposta" ADD CONSTRAINT "comunidade_resposta_duvidaId_fkey" FOREIGN KEY ("duvidaId") REFERENCES "comunidade_duvida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunidade_resposta" ADD CONSTRAINT "comunidade_resposta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
