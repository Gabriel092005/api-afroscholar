import cron from "node-cron";
import { emailEstaConfigurado, executarFunil, funilAtivo } from "@/lib/funil-emails";

/** Todos os dias às 08:00, hora de Luanda. */
export function setupFunilEmails() {
  if (!funilAtivo()) {
    console.log("✉️ Funil de emails desligado (FUNIL_EMAILS_ATIVO).");
    return;
  }

  let emCurso = false;
  cron.schedule(
    "0 8 * * *",
    async () => {
      if (emCurso || !emailEstaConfigurado()) return;
      emCurso = true;
      try {
        const r = await executarFunil();
        console.log(`✉️ Funil de emails: ${r.enviados}/${r.planeados} enviados`, r.porGatilho);
      } catch (error) {
        console.error("[funil] falha ao executar o funil de emails", error);
      } finally {
        emCurso = false;
      }
    },
    { timezone: "Africa/Luanda" }
  );
}
