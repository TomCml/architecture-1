import type { FastifyReply, FastifyRequest } from 'fastify';

export class HealthController {
  constructor(private readonly check: () => Promise<void>) {}

  health = async (_request: FastifyRequest, reply: FastifyReply) => {
    await this.check();
    return reply.send({ status: 'ok' });
  };
}
