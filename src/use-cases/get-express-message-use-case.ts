import { prisma } from "@/lib/prisma";

export async function getSettingsUseCase() {
  const setting = await prisma.setting.findFirst({
    where: { 
      slug: "system_config" // Usamos um slug fixo para a configuração global
    },
  });

  return {
    id: setting?.id,
    iban: setting?.iban ?? "AO06004000000001234567891",
    banco: setting?.Banco ?? "BAI · Angola",
    mensagem_titulo: setting?.value ?? "Pagamento via Express",
    instrucoes_slug: setting?.slug ?? "pagamento deve ser efectuado obrigatoriamente através do serviço Express...",
  };
}