import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { SignJWT } from 'jose';
import { Pool } from 'pg';
import { buildApp } from '../src/api/app.js';

const secret = 'test-secret-test-secret-test-secret-0123';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const app = buildApp(pool, { reservationTtlMinutes: 15, paymentSlowMs: 1, reservationHoldMs: 0, jwtSecret: secret, tokenTtlMinutes: 60, cookieSecure: false });

before(async () => { await app.ready(); });
beforeEach(async () => { await pool.query('TRUNCATE users'); });
after(async () => { await app.close(); await pool.end(); });

function setCookie(response: { headers: Record<string, unknown> }): string {
  const header = response.headers['set-cookie'];
  return Array.isArray(header) ? header.join('\n') : String(header ?? '');
}

function tokenFrom(response: { headers: Record<string, unknown> }): string {
  const match = /access_token=([^;]+)/.exec(setCookie(response));
  assert.ok(match, 'cookie access_token attendu');
  return match[1];
}

function register(email: string, password = 'motdepasse-solide') {
  return app.inject({ method: 'POST', url: '/api/auth/register', payload: { email, password } });
}

function me(token?: string) {
  return app.inject({ method: 'GET', url: '/api/auth/me', cookies: token ? { access_token: token } : {} });
}

test('l’inscription crée un compte et pose un cookie HttpOnly sans exposer de secret', async () => {
  const response = await register('alice@example.com');
  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.deepEqual(Object.keys(body), ['user']);
  assert.deepEqual(Object.keys(body.user).sort(), ['createdAt', 'email', 'id']);
  assert.ok(!/password|token|scrypt/i.test(response.body));
  const cookie = setCookie(response);
  assert.match(cookie, /access_token=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\//);
});

test('le mot de passe est haché avec un sel propre à chaque utilisateur', async () => {
  await register('alice@example.com', 'meme-mot-de-passe');
  await register('bob@example.com', 'meme-mot-de-passe');
  const { rows } = await pool.query<{ password_hash: string }>('SELECT password_hash FROM users ORDER BY email');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.notEqual(row.password_hash, 'meme-mot-de-passe');
    assert.ok(row.password_hash.startsWith('scrypt$'));
  }
  assert.notEqual(rows[0].password_hash, rows[1].password_hash);
});

test('l’email est normalisé et ne peut être inscrit deux fois', async () => {
  const first = await register('  Alice@Example.COM ');
  assert.equal(first.statusCode, 201);
  assert.equal(first.json().user.email, 'alice@example.com');
  const { rows } = await pool.query<{ email: string }>('SELECT email FROM users');
  assert.equal(rows[0].email, 'alice@example.com');
  const second = await register('alice@example.com');
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error.code, 'EMAIL_TAKEN');
});

test('les entrées invalides sont refusées', async () => {
  const badEmail = await register('pas-un-email');
  assert.equal(badEmail.statusCode, 400);
  assert.equal(badEmail.json().error.code, 'INVALID_INPUT');
  const shortPassword = await register('alice@example.com', 'court');
  assert.equal(shortPassword.statusCode, 400);
  assert.equal(shortPassword.json().error.code, 'INVALID_INPUT');
});

test('la connexion réussit, et les échecs ne révèlent pas l’existence du compte', async () => {
  await register('alice@example.com');
  const ok = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'Alice@example.com', password: 'motdepasse-solide' } });
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.json().user.email, 'alice@example.com');
  assert.match(setCookie(ok), /access_token=/);
  const wrongPassword = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'alice@example.com', password: 'mauvais-mot-de-passe' } });
  const unknown = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: 'inconnu@example.com', password: 'motdepasse-solide' } });
  assert.equal(wrongPassword.statusCode, 401);
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrongPassword.json().error.code, 'INVALID_CREDENTIALS');
  assert.equal(unknown.json().error.code, 'INVALID_CREDENTIALS');
  assert.equal(wrongPassword.json().error.message, unknown.json().error.message);
});

test('/api/auth/me exige un token valide', async () => {
  const registered = await register('alice@example.com');
  const token = tokenFrom(registered);
  const current = await me(token);
  assert.equal(current.statusCode, 200);
  assert.equal(current.json().user.email, 'alice@example.com');

  const anonymous = await me();
  assert.equal(anonymous.statusCode, 401);
  assert.equal(anonymous.json().error.code, 'UNAUTHENTICATED');

  const lastChar = token.endsWith('A') ? 'B' : 'A';
  assert.equal((await me(token.slice(0, -1) + lastChar)).statusCode, 401);

  const userId = registered.json().user.id;
  const foreign = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(userId).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode('un-autre-secret-un-autre-secret-0123456'));
  assert.equal((await me(foreign)).statusCode, 401);
});

test('un token expiré est refusé', async () => {
  const registered = await register('alice@example.com');
  const now = Math.floor(Date.now() / 1000);
  const expired = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(registered.json().user.id)
    .setIssuedAt(now - 7200).setExpirationTime(now - 3600).sign(new TextEncoder().encode(secret));
  const response = await me(expired);
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error.code, 'UNAUTHENTICATED');
});

test('la déconnexion efface le cookie', async () => {
  const response = await app.inject({ method: 'POST', url: '/api/auth/logout' });
  assert.equal(response.statusCode, 204);
  const cookie = setCookie(response);
  assert.match(cookie, /access_token=;/);
  assert.match(cookie, /Max-Age=0|Expires=Thu, 01 Jan 1970/i);
});
