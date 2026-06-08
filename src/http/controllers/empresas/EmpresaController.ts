

import { makeListarEmpresasUseCase } from "@/use-cases/factories/make-listar-empresas";
import { makeListarUltimasEmpresasUseCase } from "@/use-cases/factories/make-listar-ultimas-empresas";
import { FastifyReply, FastifyRequest } from "fastify";

export async function ListarEmpresasController(req: FastifyRequest, res: FastifyReply) {
  try {
    const listarUseCase = makeListarEmpresasUseCase();
    const empresas = await listarUseCase.execute(req.user.sub);

    return res.status(200).send(empresas);
  } catch (err: any) {
    return res.status(400).send({ message: err.message });
  }
}

export async function ListarUltimasEmpresasController(req: FastifyRequest, res: FastifyReply) {
  try {
    const listarUltimasUseCase = makeListarUltimasEmpresasUseCase(); 
    const empresas = await listarUltimasUseCase.execute(req.user.sub);

    return res.status(200).send(empresas);
  } catch (err: any) {
    return res.status(400).send({ message: err.message });
  }
}