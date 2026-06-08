import { prisma } from "@/lib/prisma"; // ajuste o import conforme seu projeto
import { Role } from "@/generated/enums";


export class ListGestoresWithMetricsUseCase {
  async execute() {
    const gestores = await prisma.usuario.findMany({
      where: {
        role: Role.GESTOR,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        empresas:{
          select:{
            id:true,
            nome:true,
            contacto:true,
            descricao:true,
            created_at:true,
            bots_alocados:true,
            departamentos:true,
            cor_primaria:true,
          }
        },
        last_active_at:true,
        estado_conta: true,
        created_at: true,
        image_path: true,                                                                    
        _count: {
          select: { novidades: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    const metricsRaw = await prisma.usuario.groupBy({
      by: ['estado_conta'],
      where: {
        role: Role.GESTOR 
      },
      _count: {
        _all: true
      }
    });
    const metrics = {
      total: gestores.length,
      activos: metricsRaw.find(m => m.estado_conta === 'ACTIVA')?._count._all || 0,
      suspensos: metricsRaw.find(m => m.estado_conta === 'SUSPENSA')?._count._all || 0, 
      pendentes: metricsRaw.find(m => m.estado_conta === 'PENDENTE')?._count._all || 0,
    };
    return {
      gestores,
      metrics
    };
  }
}