import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createBotController } from "./create-bot-controller";
import { FetchBotController } from "./fetch-bots";
import { GetBotDetailsController } from "./get-bot-details-controller";
import { addToCart, fetchCart } from "./cart-controller";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";
import { removeFromCartController } from "./remove-cart-contreoller";
import { ContratacaoController } from "./finalizar-contratacao";
import { BuscarBotsController } from "./fetch-bot-department";
import { AddWhatBotCanDoController } from "./what-bot-can-do.controller";
import { AddWhatBotCanNotDoController } from "./what-bot-can-not-do.controller";
import { GetBotCapabilitiesController } from "./get-bot-capabilities.controller";
import { checkoutController } from "./create-assinatura-controller";
import { fetchSubscriptions } from "./fetch0b-bots-subs";
import { AdminAssinaturaController } from "./admin-assinatura-controller";
import { AssinaturaStatsController } from "./get-stats";
import { getMyBotsController} from "./GetRecentContractsController";
import { getAdminDashboard } from "@/use-cases/admin-controller-dashboard";
import { getBotsAdmin } from "./get-bots";
import { getPayroll } from "./admin-payroll-request-controller";
import { ConfirmPaymentController, GetPendingSubscriptionsController } from "./GetPendingSubscriptionsController";
import { getSubscriptionsController } from "./get-subscriptions-controller";
import { getBotEmpresaDetailsController } from "./get-botEmpresa-details";
import { rescindirContratoController } from "./rescindir-contrato.controller";
import { FinanceiroController } from "./financeiro-controller";
import prisma from "@/lib/prisma";




export async function  BotRoutes(app:FastifyInstance) {
  app.post('/bots', createBotController);
  app.get('/bots', FetchBotController);
  app.get('/bot/:botId', getBotEmpresaDetailsController);
  app.get('/bots/department/:departmentId', BuscarBotsController);
  app.post('/addToCart', {onRequest:[verifyJWT]}, addToCart)
  app.delete('/remove', {onRequest:[verifyJWT]}, removeFromCartController)
  app.post  ('/contratacao/finalizar'   , {onRequest:[verifyJWT]}, ContratacaoController);
  app.post  ('/subscriptions/checkout'   , {onRequest:[verifyJWT]}, checkoutController);
  app.get('/cart', {onRequest:[verifyJWT]}, fetchCart)
  app.get('/bots/:botId/capabilities', GetBotCapabilitiesController);
  app.get('/bots/:id', GetBotDetailsController);
  app.post('/subscriptions/approve-', checkoutController);
  app.get('/admin/payroll', { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, getPayroll);
  // app.get('/bots/subscriptions',     { onRequest: [verifyJWT] },  getPendingController);
  app.post("/bots/can-do",     { onRequest: [verifyJWT] }, AddWhatBotCanDoController);
  app.post("/bots/can-not-do", { onRequest: [verifyJWT] }, AddWhatBotCanNotDoController);
  app.get("/admin/bots", { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, getBotsAdmin);
  app.delete(
  "/:botEmpresaId/rescindir",
   {onRequest:[verifyJWT]},
  rescindirContratoController
);
 
  
  const controller = new AdminAssinaturaController();
  const stats = new AssinaturaStatsController();

  app.get('/assinatura', { onRequest: [verifyJWT] }, controller.list);
  app.get('/subs',  { onRequest: [verifyJWT] }, getSubscriptionsController);
  app.post("/subscriptions/confirm-payment", { onRequest: [verifyJWT] }, ConfirmPaymentController);
  app.get('/bots/recents',{ onRequest: [verifyJWT] } , getMyBotsController);
  app.patch('/:assinaturaId/approve',{ onRequest: [verifyJWT] }, controller.approve);
  app.get('/assinaturas/stats', { onRequest: [verifyJWT] }, (req, reply) => stats.handle(req, reply));
  app.get("/subscriptions/pending",{ onRequest: [verifyJWT] } , GetPendingSubscriptionsController);
  app.patch('/:assinaturaId/reject', { onRequest: [verifyJWT] }, controller.reject);   
  app.get("/financeiro/relatorios", { onRequest: [verifyJWT] }, FinanceiroController.getRelatorios); 
  
  app.get('/bots/check-new', async (request, reply) => {
    const SETE_DIAS_ATRAS = new Date();
    SETE_DIAS_ATRAS.setDate(SETE_DIAS_ATRAS.getDate() - 7);

    const hasNewBots = await prisma.bot.count({
      where: {
        created_at: {
          gte: SETE_DIAS_ATRAS
        },
        status: 'ON'
      }
    });

    return { 
      hasNew: hasNewBots > 0,
      count: hasNewBots 
    };
  });                                                                                                 
}