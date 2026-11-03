# Plan — Authentification simple (N-Layer, JWT en cookie HttpOnly)

## Objectif et contraintes

- Inscription, connexion, déconnexion, utilisateur courant.
- Architecture **N-Layer** identique à l'existant : routes HTTP → service → repository / intégration → PostgreSQL. Aucune couche domaine ni inversion de dépendances (ce sera le sujet du TP 4).
- **JWT** signé, transporté **uniquement** dans un cookie `HttpOnly` (jamais dans le corps JSON ni dans `localStorage`).
- Mot de passe **haché** en base (jamais stocké ni renvoyé en clair).
- Authentification simple : pas de 2FA, pas d'OTP, pas de refresh token, pas de reset de mot de passe.

## Hors périmètre (volontairement)

- Les routes existantes (`/api/events`, `/api/reservations`, checkout) restent **publiques et inchangées** : le contrat observable et les 9 tests actuels ne doivent pas bouger. Lier une réservation à l'utilisateur connecté est une décision séparée (à prendre au TP 3).
- Pas de rôles, pas de révocation de token côté serveur (la déconnexion efface le cookie).

## Choix techniques

| Besoin | Choix | Raison |
|---|---|---|
| Hachage | `node:crypto` `scrypt` + sel aléatoire 16 octets + `timingSafeEqual` | Algorithme lent adapté aux mots de passe, natif Node, aucune compilation native dans l'image Alpine. |
| JWT | paquet `jose` (HS256) | Bibliothèque maintenue, sans dépendance, indépendante de Fastify (donc utilisable depuis la couche intégration). |
| Cookies | paquet `@fastify/cookie` | Lecture/écriture des cookies dans la couche HTTP uniquement. |

Format stocké en base : `scrypt$<N>$<r>$<p>$<sel base64>$<hash base64>` (N=16384, r=8, p=1, clé 64 octets), pour pouvoir faire évoluer les paramètres plus tard.

Cookie : nom `access_token`, `HttpOnly`, `SameSite=Strict` (protection CSRF), `Path=/`, `Max-Age` = durée du token, `Secure` piloté par la config (`COOKIE_SECURE`, défaut `false` car la démo tourne en HTTP sur localhost).

## Découpage par couche

### 1. Persistance — `db/migrations/002_users.sql`

```sql
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (lower(email));
```

`src/migrate.ts` : exécuter **tous** les fichiers `.sql` de `db/migrations/` triés par nom (au lieu du seul `001_init.sql` codé en dur), puis le seed. Les migrations restent idempotentes (`IF NOT EXISTS`).

### 2. Types partagés — `src/types.ts`

- `UserView { id: string; email: string; createdAt: string }` — **sans** hash.

### 3. Accès aux données — `src/repositories/UserRepository.ts`

Même style que les repositories existants (type `UserRow` interne, fonction `toView`).
- `create(id, email, passwordHash): Promise<UserView>` — un conflit d'unicité PostgreSQL (code `23505`) est traduit en `AppError(409, 'EMAIL_TAKEN', …)` pour couvrir la course entre deux inscriptions simultanées.
- `findCredentialsByEmail(email): Promise<{ user: UserView; passwordHash: string } | null>` — recherche sur `lower(email)`. Seule méthode qui sort le hash, et seulement vers le service.
- `findById(id): Promise<UserView | null>`.

### 4. Intégrations techniques — `src/integrations/`

- `PasswordHasher.ts` : `hash(password): Promise<string>`, `verify(password, stored): Promise<boolean>` (scrypt promisifié, `timingSafeEqual`, retourne `false` si le format stocké est invalide).
- `TokenIssuer.ts` : constructeur `(secret: string, ttlMinutes: number)` ; `sign(userId): Promise<string>` (claims `sub`, `iat`, `exp`) ; `verify(token): Promise<string | null>` (retourne le `sub`, ou `null` si signature invalide, expiré ou malformé — ne lève jamais).

### 5. Service — `src/services/AuthService.ts`

Nouvelle classe (ne **pas** grossir `TicketingService`), dépendances concrètes injectées par le constructeur comme pour `TicketingService` : `UserRepository`, `PasswordHasher`, `TokenIssuer`.

- `register(email, password)` → `{ user, token }`
  - normalise l'email (`trim().toLowerCase()`), valide le format (regex simple, ≤ 254 caractères) et le mot de passe (8 à 128 caractères) → sinon `400 INVALID_INPUT` ;
  - vérifie l'unicité → `409 EMAIL_TAKEN` ;
  - hache, crée, émet un token (l'inscription connecte directement).
- `login(email, password)` → `{ user, token }`
  - email inconnu **ou** mauvais mot de passe → **même** erreur `401 INVALID_CREDENTIALS` (« Email ou mot de passe incorrect. ») pour ne pas révéler l'existence d'un compte ;
  - si l'email est inconnu, vérifier quand même contre un hash factice pour garder un temps de réponse comparable.
- `getCurrentUser(token | undefined)` → `UserView`
  - token absent, invalide, expiré, ou utilisateur supprimé → `401 UNAUTHENTICATED`.

### 6. HTTP — `src/app.ts`

- `buildApp(pool, config)` : le type de `config` devient `AppConfig = TicketingConfig & AuthConfig`, avec `AuthConfig { jwtSecret: string; tokenTtlMinutes: number; cookieSecure: boolean }` (exporté depuis `AuthService.ts`).
- Enregistrer `@fastify/cookie`.
- Routes :

| Route | Succès | Erreurs |
|---|---|---|
| `POST /api/auth/register` `{ email, password }` | `201 { user }` + `Set-Cookie` | 400, 409 |
| `POST /api/auth/login` `{ email, password }` | `200 { user }` + `Set-Cookie` | 400, 401 |
| `POST /api/auth/logout` | `204` + cookie effacé | — |
| `GET /api/auth/me` | `200 { user }` | 401 |

- Le token n'apparaît **jamais** dans le corps de la réponse. Le hash non plus.
- Les erreurs passent par le gestionnaire existant (format `{ error: { code, message } }` inchangé).
- Pas de `preHandler` global : aucune route existante n'est protégée (voir hors périmètre).

### 7. Composition root et configuration

- `src/server.ts` : lire `JWT_SECRET` (obligatoire : si absent ou < 32 caractères, arrêter au démarrage avec un message clair), `AUTH_TOKEN_TTL_MINUTES` (défaut 60), `COOKIE_SECURE` (`'true'` → `true`, défaut `false`).
- `compose.yaml` : ajouter `JWT_SECRET: ${JWT_SECRET:-dev-only-secret-change-me-0123456789abcdef}` au service `app`. Le service `test` n'en a pas besoin (les tests passent la config directement à `buildApp`).
- `tests/api.test.ts` et `tests/concurrency.challenge.ts` : compléter l'objet de config passé à `buildApp` (secret de test, TTL, `cookieSecure: false`). **Aucune autre modification** de ces fichiers.

### 8. Interface — `public/`

Petit bloc « Compte » dans `index.html` (email, mot de passe, boutons Se connecter / Créer un compte / Se déconnecter, affichage de l'email connecté) et logique correspondante dans `app.js` (`fetch` avec `credentials: 'same-origin'`, appel de `/api/auth/me` au chargement). Réutiliser les classes CSS existantes ; ajout CSS minimal si nécessaire. Le JS ne lit **jamais** le token (il ne le peut pas : HttpOnly).

### 9. Documentation

- `README.md` : ajouter les 4 routes au tableau API et `JWT_SECRET` / `AUTH_TOKEN_TTL_MINUTES` / `COOKIE_SECURE` aux variables.

## Tests — `tests/auth.test.ts`

Même style que `tests/api.test.ts` (`node:test`, `app.inject`, base `db-test`). `beforeEach` : `TRUNCATE users`.

`package.json` : `"test": "tsx --test --test-concurrency=1 tests/api.test.ts tests/auth.test.ts"` (les deux fichiers partagent la base de test et ne doivent pas tourner en parallèle).

Scénarios :
1. Inscription → `201`, `{ user: { id, email, createdAt } }`, pas de champ `password`/`passwordHash`/`token` dans le corps ; `Set-Cookie` contient `access_token=`, `HttpOnly`, `SameSite=Strict`, `Path=/`.
2. En base, `password_hash` ≠ mot de passe, commence par `scrypt$` ; deux utilisateurs avec le même mot de passe ont des hash différents (sel).
3. Email normalisé : `  Alice@Example.COM ` est stocké `alice@example.com` ; une seconde inscription `alice@example.com` → `409 EMAIL_TAKEN`.
4. Entrées invalides (email mal formé, mot de passe < 8) → `400 INVALID_INPUT`.
5. Connexion correcte → `200` + cookie ; mauvais mot de passe et email inconnu → tous deux `401 INVALID_CREDENTIALS` avec le **même** message.
6. `GET /api/auth/me` avec le cookie → `200` et le bon email ; sans cookie → `401 UNAUTHENTICATED` ; avec un token modifié (dernier caractère changé) → `401` ; avec un token signé par un autre secret → `401`.
7. Token expiré → `401` (construire une seconde app avec `tokenTtlMinutes` très court, ou signer un token avec `jose` et un `exp` passé, en utilisant le même secret de test).
8. Déconnexion → `204`, `Set-Cookie` qui expire `access_token` (`Max-Age=0` ou `Expires` passé).
9. Les 9 tests de `tests/api.test.ts` passent toujours sans modification autre que la config.

Commande : `docker compose --profile test run --build --rm test`.

## Ordre d'exécution

1. Dépendances (`npm install jose @fastify/cookie`, mettre à jour `package-lock.json`).
2. Migration + `migrate.ts`.
3. Types → repository → intégrations → service → routes → `server.ts` / `compose.yaml`.
4. Tests (écrire `tests/auth.test.ts`, mettre à jour les configs de test), lancer la suite Docker jusqu'au vert.
5. Interface, puis vérification manuelle : `docker compose up --build -d`, inscription/connexion/déconnexion via `curl -c/-b` sur `http://localhost:3000`.
6. README.

## Critères d'acceptation

- `docker compose --profile test run --build --rm test` : tous les tests verts (9 existants + nouveaux).
- `npm run build` sans erreur TypeScript.
- Aucun mot de passe en clair en base ni dans les logs ; aucun token dans un corps de réponse.
- Contrat des routes existantes inchangé.
