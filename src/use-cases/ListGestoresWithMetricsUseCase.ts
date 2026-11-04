import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/enums";

export class ListGestoresWithMetricsUseCase {
  async execute() {
    const gestores = await prisma.user.findMany({
      where: { role: Role.GESTOR },
      select: {
        id: true,
        nome: true,
        email: true,
        paisMentoria: true,
        last_active_at: true,
        estado_conta: true,
        created_at: true,
        image_path: true,
        _count: {
          select: { novidades: true, bolsasCriadas: true, cursosCriados: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const activos = gestores.filter((g) => g.estado_conta === "ACTIVA").length;

    return {
      gestores,
      metrics: {
        total: gestores.length,
        activos,
        suspensos: gestores.length - activos,
      },
    };
  }
}
