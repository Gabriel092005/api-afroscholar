import { FastifyInstance } from "fastify";
import { registerController } from "./register";
import { Authenticate } from "./authenticate";
import { verifyJWT } from "../middleware/verify-jwt";
import { verifyUserRole } from "../middleware/verify-user-role";
import { getProfile } from "./get-profile";
import { updateProfileController } from "./update-profile-controller";
import { updateProfileImage } from "./update-photo";
import { LogOut } from "./log-out";
import { requestMagicLink } from "./magic-link-request";
import { verifyMagicLink } from "./magic-link-verify";
import { forgotPassword } from "./forgot-password-controller";
import { resetPassword } from "./reset-password-controller";
import { listGestoresController } from "./ListGestoresController";
import { suspendUsuarioController } from "./SuspendUsuarioController";
import { listUsuarios } from "./list-usuarios-controller";
import { alterarRoleController } from "./alterar-role-controller";
import { getUserMetricsController } from "./metrics-user-controller";
import { getHealthOverview } from "./churn-metrics";


export async function userRoutes(app:FastifyInstance) {
     app.post('/users', registerController)
     app.post('/sessions',Authenticate)
     app.get('/profile', {onRequest:[verifyJWT]}, getProfile)
     app.get('/metrics', {onRequest:[verifyJWT]}, getUserMetricsController )
     app.get('/gestores/metrics', { onRequest: [verifyJWT] }, listGestoresController)
     app.put('/update/profile-image', { onRequest: [verifyJWT]}, updateProfileImage)
     app.patch('/usuarios/:id/status', suspendUsuarioController)
     app.get('/churn/metrics', getHealthOverview)
     app.put('/update', {onRequest:[verifyJWT]}, updateProfileController)
     app.post("/log-out", LogOut);
     app.post("/magic-link/request", requestMagicLink);
     app.post("/magic-link/verify", verifyMagicLink);
     app.post("/password/forgot", forgotPassword);
     app.post("/password/reset", resetPassword);

     app.get('/admin/usuarios', { onRequest: [verifyJWT, verifyUserRole("ADMIN", "GESTOR")] }, listUsuarios);
     app.patch('/admin/usuarios/:id/role', { onRequest: [verifyJWT, verifyUserRole("ADMIN")] }, alterarRoleController);
}