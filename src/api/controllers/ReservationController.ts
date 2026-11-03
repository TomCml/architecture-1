import type { FastifyReply, FastifyRequest } from 'fastify';
import type {
  CheckoutReservationUseCase,
  GetReservationUseCase,
  ReserveSeatUseCase,
} from '../../application/usecases/index.js';
import { parseCheckoutScenario, parseCreateReservation, parseReservationId } from '../validation/index.js';

type IdParams = { Params: { id: string } };

export class ReservationController {
  constructor(
    private readonly reserveSeat: ReserveSeatUseCase,
    private readonly getReservation: GetReservationUseCase,
    private readonly checkoutReservation: CheckoutReservationUseCase,
  ) {}

  create = async (request: FastifyRequest, reply: FastifyReply) => {
    const reservation = await this.reserveSeat.execute(parseCreateReservation(request.body));
    return reply.code(201).send({ reservation: reservation.toJSON() });
  };

  getById = async (request: FastifyRequest<IdParams>) => {
    const { reservation, paymentAttempts } = await this.getReservation.execute(parseReservationId(request.params));
    return { reservation: { ...reservation.toJSON(), paymentAttempts: paymentAttempts.map(attempt => attempt.toJSON()) } };
  };

  checkout = async (request: FastifyRequest<IdParams>) => {
    const id = parseReservationId(request.params);
    const { reservation, paymentAttempt } = await this.checkoutReservation.execute(id, parseCheckoutScenario(request.body));
    return { reservation: reservation.toJSON(), paymentAttempt: paymentAttempt.toJSON() };
  };
}
