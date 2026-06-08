import { DepartamentosRepository } from "@/repositories/dept-repository"


interface ListDepartamentosRequest {
  empresaId: string
}

export class ListDepartamentosUseCase {
  constructor(private departamentosRepository: DepartamentosRepository) {}

  async execute({ empresaId }: ListDepartamentosRequest) {
    const departamentos = await this.departamentosRepository.listByEmpresaId(empresaId)
    return { departamentos }
  }
}