import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/verify-jwt';
import { EmpresaController } from './create-new-company';
import { ListarEmpresasController, ListarUltimasEmpresasController } from './EmpresaController';
import { getEmpresasProfileController } from './get-empresa-profile';
import { upload } from '@/lib/upload';
import { updateEmpresaController } from './update-profile';
import { listEmpresasMetricsController } from './list-empresas-metrics-controller';
import { deleteEmpresaController } from './DeleteEmpresaController';
import { EmpresaControllers } from './list-departments';


export async function CompanyRoutes(app: FastifyInstance) {
  app.addHook('onRequest', verifyJWT);
  app.post('/empresas/register', EmpresaController);
  app.get('/empresas', ListarEmpresasController);
  app.delete('/empresas/:id', deleteEmpresaController)
  app.get('/empresas/:empresaId/departamentos', EmpresaControllers.listarDepartamentos);
  app.get('/empresas/:empresaId/bots', EmpresaControllers.listarBots);
  app.get('/empresas/:empresaId/financeiro/total', EmpresaControllers.calcularTotalAssinaturas);
  app.get('/empresas/profile/:empresaId', getEmpresasProfileController);
  app.patch('/empresas/:id', updateEmpresaController);
  app.get("/empresas/metrics",listEmpresasMetricsController);
  app.get('/empresas/recentes', ListarUltimasEmpresasController);
}