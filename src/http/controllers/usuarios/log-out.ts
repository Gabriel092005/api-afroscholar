import { FastifyReply, FastifyRequest } from "fastify";


export async function LogOut(req:FastifyRequest, res:FastifyReply){
    try {
  
    res.clearCookie("token", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    // secure: true, // se usar HTTPS
  })

   res.clearCookie("refreshToken", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  })

  return res.send({ message: "Logout realizado com sucesso" })

    } catch (error) {
        console.error(error)
        return error
    }

}