-- CRM: leads acompanhados pela equipa de atendimento e o histórico de cada um.
CREATE TYPE "EtapaLead" AS ENUM ('NOVO', 'CONTACTADO', 'INTERESSADO', 'CONVERTIDO', 'PERDIDO');

CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "atendenteId" TEXT,
    "etapa" "EtapaLead" NOT NULL DEFAULT 'NOVO',
    "origem" TEXT NOT NULL,
    "produto" TEXT,
    "caminho" TEXT,
    "valorPotencial" DOUBLE PRECISION,
    "proximoContacto" TIMESTAMP(3),
    "ultimoContacto" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_lead_interacoes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "autorId" TEXT,
    "tipo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_lead_interacoes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_leads_usuarioId_key" ON "crm_leads"("usuarioId");
CREATE INDEX "crm_leads_atendenteId_etapa_idx" ON "crm_leads"("atendenteId", "etapa");
CREATE INDEX "crm_leads_proximoContacto_idx" ON "crm_leads"("proximoContacto");
CREATE INDEX "crm_lead_interacoes_leadId_created_at_idx" ON "crm_lead_interacoes"("leadId", "created_at");

ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_atendenteId_fkey" FOREIGN KEY ("atendenteId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_lead_interacoes" ADD CONSTRAINT "crm_lead_interacoes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_lead_interacoes" ADD CONSTRAINT "crm_lead_interacoes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
