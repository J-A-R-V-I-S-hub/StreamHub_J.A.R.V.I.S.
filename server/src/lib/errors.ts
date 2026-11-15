import type { FastifyReply } from "fastify";

/** Formato unico degli errori: { error, message } */
export function fail(reply: FastifyReply, status: number, error: string, message: string) {
  return reply.code(status).send({ error, message });
}
