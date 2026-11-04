import cron from "node-cron";
import { encerrarMentoriasExpiradas } from "@/lib/mentoria-expiracao";
import { sincronizarPendentes } from "@/lib/pagamentos-momenu";

export function setupSincronizacaoPagamentos() {
  let emCurso = false;

  cron.schedule("*/5 * * * *", async () => {
    if (emCurso) return;
    emCurso = true;
    try {
      await sincronizarPendentes();
    } catch (error) {
      console.error("[momenu] falha ao sincronizar pagamentos pendentes", error);
    }
    try {
      await encerrarMentoriasExpiradas();
    } catch (error) {
      console.error("[mentoria] falha ao encerrar mentorias expiradas", error);
    } finally {
      emCurso = false;
    }
  });
}
