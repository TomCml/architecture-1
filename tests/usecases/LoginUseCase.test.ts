import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LoginUseCase, RegisterUseCase } from '../../src/application/usecases/index.js';
import { FakePasswordHasher, FakeTokenService, FakeUserRepository, rejection } from '../helpers/fakes.js';

async function build() {
  const users = new FakeUserRepository();
  const hasher = new FakePasswordHasher();
  const tokens = new FakeTokenService();
  await new RegisterUseCase(users, hasher, tokens).execute('alice@example.com', 'motdepasse-solide');
  return new LoginUseCase(users, hasher, tokens);
}

describe('LoginUseCase', () => {
  test('email inconnu et mauvais mot de passe donnent la même erreur 401', async () => {
    const useCase = await build();
    const unknown = await rejection(useCase.execute('inconnu@example.com', 'motdepasse-solide'));
    const wrong = await rejection(useCase.execute('alice@example.com', 'mauvais-mot-de-passe'));
    assert.equal(unknown.statusCode, 401);
    assert.equal(wrong.statusCode, 401);
    assert.equal(unknown.code, 'INVALID_CREDENTIALS');
    assert.equal(wrong.code, 'INVALID_CREDENTIALS');
    assert.equal(unknown.message, wrong.message);
  });

  test('succès : retourne l’utilisateur et un jeton', async () => {
    const useCase = await build();
    const { user, token } = await useCase.execute(' Alice@Example.com ', 'motdepasse-solide');
    assert.equal(user.email, 'alice@example.com');
    assert.equal(token, `token:${user.id}`);
  });
});
