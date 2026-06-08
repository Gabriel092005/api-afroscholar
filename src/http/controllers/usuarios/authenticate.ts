
import {z} from'zod'
import { FastifyRequest,FastifyReply } from "fastify";
import { invalidCredentialsError } from '@/repositories/errors/invalid-credentials';
import { makeAuthenticateUseCase } from '@/use-cases/factories/make-authenticate';

export async function Authenticate(request:FastifyRequest,reply:FastifyReply) {
   const AuthenticateBodySchema = z.object({
       email: z.string().email(),
       password:z.string()
    })    
   const {email,password} = AuthenticateBodySchema.parse(request.body)
    try {
     const authenticateUseCase =  makeAuthenticateUseCase()
     const { user } =  await authenticateUseCase.execute({
          email,
          password
     })
     const token = await reply.jwtSign(
      {
         role : user.role
      },
      {
           sub: String(user.id),   
           expiresIn:'2d'
      })
      
   const refreshToken = await reply.jwtSign(
      {
         role : user.role 

      },

      {
       
            sub:String(user.id),
            expiresIn:'7d',
         
      }
   )
      return reply
      .setCookie('refreshToken',refreshToken,{
         path : '/',
         secure:true,
         httpOnly:true,
         sameSite:'none'
     })
      .status(200)
      .send({
        token,
        user: {
          id: user.id,
          nome: user.nome,
          email: user.email,
          role: user.role,
          image_path: user.image_path,
          estado_conta: user.estado_conta,
          phone: user.phone,
          created_at: user.created_at,
          last_active_at: user.last_active_at,
        },
      })

   }
    catch (error) { 
      if( error instanceof invalidCredentialsError){
         return reply.status(400).send({message : error.message })
      }
      if( error instanceof Error){
         return reply.status(409).send({message : error.message })
      }
       
   }

   
}


