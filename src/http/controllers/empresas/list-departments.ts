// src/controllers/empresa-controller.ts
import prisma from '@/lib/prisma';
import { FastifyRequest, FastifyReply } from 'fastify';

export const EmpresaControllers = {
  async listarDepartamentos(request: FastifyRequest, reply: FastifyReply) {
    const { empresaId } = request.params as { empresaId: string };
    const departamentos = await prisma.departamento.findMany({
      where: { empresaId },
      orderBy: { nome: 'asc' }
    });

    return reply.status(200).send(departamentos);
  },
  async listarBots(request: FastifyRequest, reply: FastifyReply) {
    const { empresaId } = request.params as { empresaId: string };


    const botsAlocados = await prisma.botEmpresa.findMany({
      where: { empresaId },
      include: {
        bot: {
          select: {
            nome: true,
            funcao: true,
            avatar_url: true,
            preco_mensal: true
          }
        },
        departamento: {
          select: { nome: true }
        }
      }
    });

    return reply.status(200).send(botsAlocados);
  },

  // 3. Calcular Total a Pagar (Soma das Assinaturas)
  async calcularTotalAssinaturas(request: FastifyRequest, reply: FastifyReply) {
    const { empresaId } = request.params as { empresaId: string };


    // Agregação assíncrona para somar valores
    const resultado = await prisma.assinatura.aggregate({
      where: {
        empresaId,
        ativa: true,
        status: 'APROVADO'
      },
      _sum: {
        valorContrato: true
      }
    });

    const total = resultado._sum.valorContrato || 0;

    return reply.send({
      empresaId,
      totalPagar: Number(total).toFixed(2),
      moeda: "AOA",
      dataConsulta: new Date()
    });
  }
};