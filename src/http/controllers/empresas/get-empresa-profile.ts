

import { makeGetEmpresasUseCase } from "@/use-cases/factories/make-getEmpresaProfile";
import { makeListarEmpresasUseCase } from "@/use-cases/factories/make-listar-empresas";
import { makeListarUltimasEmpresasUseCase } from "@/use-cases/factories/make-listar-ultimas-empresas";
import { FastifyReply, FastifyRequest } from "fastify";
import z from "zod";

 const getEmpresaProfileSchema = z.object({
    empresaId:z.string().uuid()
 })
export async function getEmpresasProfileController(req: FastifyRequest, res: FastifyReply) {
  try {
    const { empresaId } = getEmpresaProfileSchema.parse(req.params)
    const UseCase = makeGetEmpresasUseCase();

    const empresas = await UseCase.execute({
        empresaId
    });

    return res.status(200).send(empresas);
  } catch (err: any) {
    return res.status(400).send({ message: err.message });
  }
}

