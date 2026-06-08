import { PrismaDepartamentosRepository } from '@/repositories/prisma/prisma-dep-repository'
import { ListDepartamentosUseCase } from '../list-departamentos'

export function makeListDepartamentoUseCase() {
  const repository = new PrismaDepartamentosRepository()
  return new ListDepartamentosUseCase(repository)
}

