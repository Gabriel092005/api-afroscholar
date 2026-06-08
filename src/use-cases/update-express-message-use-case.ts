import { prisma } from "@/lib/prisma";

interface UpdateSettingsRequest {
  iban?: string;
  banco?: string;
  mensagem?: string;
}

export async function updateSettingsUseCase({ iban, banco, mensagem }: UpdateSettingsRequest) {
  // Usamos um SLUG fixo para garantir que sempre editaremos a mesma linha no banco
  const CONFIG_SLUG = "system_config";

  const setting = await prisma.setting.upsert({
    where: { 
      slug: CONFIG_SLUG 
    },
    update: {
      ...(iban && { iban }),
      ...(banco && { Banco: banco }),
      ...(mensagem && { value: mensagem }),
    },
    create: {
      slug: CONFIG_SLUG,
      iban: iban ?? "AO06004000000001234567891",
      Banco: banco ?? "BAI · Angola",
      value: mensagem ?? "Pagamento via Express",
    },
  });

  return setting;
}