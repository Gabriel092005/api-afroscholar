import { PrismaClient } from '@/generated/client';
import prisma from "@/lib/prisma";

export class BuscarBotsDepartamentoUseCase {
  async execute(departamentoId: string) {
    const botsContratados = await prisma.botEmpresa.findMany({
      where: {

        departamentoId: departamentoId,
         status: 'ACTIVA', 
         
      },
      include: {
        bot: {
            include:{
                assets:true
            }
            
        }, 
        departamento:{
            select:{
                id:true,
                empresaId:true,
                nome:true
                
            }
        }
      },
      orderBy: {
        data_contrato: 'desc'
      }
    });

    return botsContratados;
  }
}