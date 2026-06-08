import { AdminSubscriptionUseCase} from '@/use-cases/admin-assinatura-use-case';
import { FastifyRequest, FastifyReply } from 'fastify';
import { approvalSchema, rejectSchema } from './assinaturas-scheme';


export class AdminAssinaturaController {
  private useCase = new AdminSubscriptionUseCase();

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    const assinaturas = await this.useCase.listAll();
    return reply.send(assinaturas);
  };


approve = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const { assinaturaId } = approvalSchema.parse(request.params);
    
    const assinatura = await this.useCase.approve(assinaturaId);

    return reply.send({ 
      message: "Assinatura aprovada. O bot foi vinculado ao departamento e a folha de pagamento deste mês foi gerada.", 
      assinatura 
    });
  } catch (error) {
    return reply.status(400).send({ message: "Erro ao aprovar assinatura." });
  }
};

  reject = async (request: FastifyRequest, reply: FastifyReply) => {
    const { assinaturaId } = rejectSchema.parse(request.params);
    // Opcional: tratar o 'motivo' vindo do body se quiser salvar num log
    const assinatura = await this.useCase.reject(assinaturaId);
    return reply.send({ message: "Assinatura rejeitada", assinatura });
  };
}