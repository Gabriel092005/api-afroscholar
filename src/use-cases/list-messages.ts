import { prisma } from "@/lib/prisma";

interface ListarMensagensRequest {
  botEmpresaId: string;
  usuarioId: string;
}

export class ListarMensagensUseCase {
  async execute({ botEmpresaId, usuarioId }: ListarMensagensRequest) {
    const mensagens = await prisma.mensagem.findMany({
      where: { botEmpresaId, usuarioId },
      orderBy: { createdAt: "asc" },
      include: { anexos : true,  usuario:{
        select:{
            id:true,
            role:true,
            image_path:true,
            nome:true,
            email:true,
        }
      } },
    });
    return mensagens;
  }
}