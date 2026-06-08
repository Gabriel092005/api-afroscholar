import { prisma } from '@/lib/prisma'
import { DepartamentosRepository } from '../dept-repository'
import { Prisma } from '@/generated/client'

export class PrismaDepartamentosRepository implements DepartamentosRepository {
async create(data: Prisma.DepartamentoUncheckedCreateInput) {
    const departamento = await prisma.departamento.create({ data })
    return departamento
  }

  async listByEmpresaId(empresaId: string) {
    const departamentos = await prisma.departamento.findMany({
      where: { 
          empresaId

       },
       include:{

        bots:{
          
            select:{
                botId:true,
                departamentoId:true,
                bot:{
                  include:{
                    assets:true
                  }
                }
                
            }
        }
       }
    })
    return departamentos
  }
}