-- Funil de vendas por email: preferência de subscrição e registo dos gatilhos enviados.
ALTER TABLE "User" ADD COLUMN "recebeEmailsMarketing" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "emails_funil" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "gatilho" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emails_funil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "emails_funil_usuarioId_gatilho_chave_key" ON "emails_funil"("usuarioId", "gatilho", "chave");
CREATE INDEX "emails_funil_enviadoEm_idx" ON "emails_funil"("enviadoEm");

ALTER TABLE "emails_funil" ADD CONSTRAINT "emails_funil_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
