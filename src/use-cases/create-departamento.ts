import { DepartamentosRepository } from "@/repositories/dept-repository"


interface CreateDepartamentoRequest {
  nome: string
  empresaId: string
}

export class CreateDepartamentoUseCase {
  constructor(private departamentosRepository: DepartamentosRepository) {}

  async execute({ nome, empresaId }: CreateDepartamentoRequest) {
    const departamento = await this.departamentosRepository.create({
      nome,
      empresaId,
    })
    return { departamento }
  }
}