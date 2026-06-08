import { Departamento } from "@/generated/client"
import { Prisma } from "@/generated/client"


export interface DepartamentosRepository {
  create(data: Prisma.DepartamentoUncheckedCreateInput): Promise<Departamento>
  listByEmpresaId(empresaId: string): Promise<Departamento[]>
}