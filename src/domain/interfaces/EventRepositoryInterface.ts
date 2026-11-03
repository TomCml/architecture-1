import type { Event } from '../entities/Event.js';

export interface EventRepositoryInterface {
  list(): Promise<Event[]>;
  findById(id: string): Promise<Event | null>;
}
