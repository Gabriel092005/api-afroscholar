import { empresaRepository } from "@/repositories/empresa-repository";

export class ListarEmpresasUseCase {
  constructor(private empresaRepository: empresaRepository) {}

  async execute(usuarioId: string) {
    return await this.empresaRepository.listAll(usuarioId);
  }
}