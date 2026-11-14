import cron from "node-cron";
import { env } from "@/Env";
import { avisarMonitoresNovosMentorandos } from "@/lib/avisos-equipa";
import { enviarResumoDiarioAtendentes, sincronizarLeads } from "@/lib/crm";

/**
 * Rotinas da equipa (atendimento, monitores), sempre activas.
 * CRM_AUTOMATICO_ATIVO=false desliga-as (ex.: num ambiente de testes).
 */
function ativo() {
  return env.CRM_AUTOMATICO_ATIVO !== "false";
}

/** Corre a tarefa sem sobreposição: se a anterior ainda não acabou, esta é saltada. */
function agendar(expressao: string, nome: string, tarefa: () => Promise<void>) {
  let emCurso = false;
  cron.schedule(
    expressao,
    async () => {
      if (emCurso) return;
      emCurso = true;
      try {
        await tarefa();
      } catch (error) {
        console.error(`[equipa] falha na rotina "${nome}"`, error);
      } finally {
        emCurso = false;
      }
    },
    { timezone: "Africa/Luanda" }
  );
}

export function setupCrmDiario() {
  if (!ativo()) {
    console.log("📇 Rotinas automáticas da equipa desligadas (CRM_AUTOMATICO_ATIVO=false).");
    return;
  }

  // De 5 em 5 minutos: mentorandos novos nas comunidades → monitores dão as boas-vindas.
  agendar("*/5 * * * *", "boas-vindas", async () => {
    const n = await avisarMonitoresNovosMentorandos();
    if (n > 0) console.log(`👋 Monitores avisados de ${n} mentorando(s) novo(s).`);
  });

  // De 15 em 15 minutos: potenciais clientes novos → lead no CRM e alerta ao atendente.
  agendar("*/15 * * * *", "potenciais clientes", async () => {
    const { criados } = await sincronizarLeads();
    if (criados > 0) console.log(`📇 CRM: ${criados} potencial(is) cliente(s) novo(s).`);
  });

  // Todas as manhãs às 07:30: a lista do dia de cada atendente (app, push, email e WhatsApp).
  agendar("30 7 * * *", "resumo diário", async () => {
    const r = await enviarResumoDiarioAtendentes();
    console.log(`📇 Resumo diário enviado a ${r.atendentes} atendente(s).`);
  });
}
