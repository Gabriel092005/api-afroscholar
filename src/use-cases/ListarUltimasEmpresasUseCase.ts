import { empresaRepository } from "@/repositories/empresa-repository";

export class ListarUltimasEmpresasUseCase {
  constructor(private empresaRepository: empresaRepository) {}

  async execute(usuarioId: string) {
    return await this.empresaRepository.listLastSeven(usuarioId);
  }
}