import { FastifyInstance } from "fastify";
import { verifyJWT } from "../middleware/verify-jwt";
import { create } from "./create";
import { ListDept } from "./list-all-dept";


export async function DepartamentosRoutes(app:FastifyInstance) {
    app.addHook('onRequest', verifyJWT);
    app.post('/departament/create',create)   
    app.get('/departament/list/:empresaId', ListDept)
}