-- Conversas: canal permanente entre o cliente e a equipa (atendimento, monitores, admin).
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABERTA',
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "naoLidasCliente" INTEGER NOT NULL DEFAULT 0,
    "naoLidasEquipa" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversa_mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "autorId" TEXT,
    "daEquipa" BOOLEAN NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversa_mensagens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversas_clienteId_key" ON "conversas"("clienteId");
CREATE INDEX "conversas_estado_ultimaMensagemEm_idx" ON "conversas"("estado", "ultimaMensagemEm");
CREATE INDEX "conversa_mensagens_conversaId_created_at_idx" ON "conversa_mensagens"("conversaId", "created_at");

ALTER TABLE "conversas" ADD CONSTRAINT "conversas_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversa_mensagens" ADD CONSTRAINT "conversa_mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversa_mensagens" ADD CONSTRAINT "conversa_mensagens_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
