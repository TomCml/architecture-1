import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RegisterUseCase } from '../../src/application/usecases/index.js';
import { FakePasswordHasher, FakeTokenService, FakeUserRepository, rejection } from '../helpers/fakes.js';

function build() {
  const users = new FakeUserRepository();
  return { users, useCase: new RegisterUseCase(users, new FakePasswordHasher(), new FakeTokenService()) };
}

describe('RegisterUseCase', () => {
  test('email invalide : 400', async () => {
    const error = await rejection(build().useCase.execute('pas-un-email', 'motdepasse-solide'));
    assert.equal(error.statusCode, 400);
    assert.equal(error.code, 'INVALID_INPUT');
  });

  test('mot de passe trop court ou trop long : 400', async () => {
    const { useCase } = build();
    for (const password of ['court', 'x'.repeat(129)]) {
      const error = await rejection(useCase.execute('alice@example.com', password));
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, 'INVALID_INPUT');
    }
  });

  test('email déjà inscrit : 409 EMAIL_TAKEN', async () => {
    const { useCase } = build();
    await useCase.execute('alice@example.com', 'motdepasse-solide');
    const error = await rejection(useCase.execute('ALICE@example.com', 'motdepasse-solide'));
    assert.equal(error.statusCode, 409);
    assert.equal(error.code, 'EMAIL_TAKEN');
  });

  test('l’email est normalisé et le mot de passe haché', async () => {
    const { users, useCase } = build();
    const { user, token } = await useCase.execute('  Alice@Example.COM ', 'motdepasse-solide');
    assert.equal(user.email, 'alice@example.com');
    assert.equal(token, `token:${user.id}`);
    assert.equal(users.users.get('alice@example.com')?.passwordHash, 'hashed:motdepasse-solide');
  });
});
