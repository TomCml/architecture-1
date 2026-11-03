export const AUTH_COOKIE_NAME = 'access_token';

export function cookieOptions(secure: boolean, maxAgeSeconds?: number) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure,
    ...(maxAgeSeconds === undefined ? {} : { maxAge: maxAgeSeconds }),
  } as const;
}
