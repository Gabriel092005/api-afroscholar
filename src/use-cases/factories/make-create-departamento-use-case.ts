import { PrismaDepartamentosRepository } from '@/repositories/prisma/prisma-dep-repository'
import { CreateDepartamentoUseCase } from '../create-departamento'

export function makeCreateDepartamentoUseCase() {
  const repository = new PrismaDepartamentosRepository()
  return new CreateDepartamentoUseCase(repository)
}

