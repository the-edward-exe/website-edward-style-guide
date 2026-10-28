import type { MiddlewareHandler } from 'astro';
import { getProfile } from './lib/profiles';

const PROFILE_PATH = /^\/(?:api\/)?p\/([^/]+)/;

// Any profile URL whose profile doesn't exist gets the 404 page.
export const onRequest: MiddlewareHandler = async (context, next) => {
  const m = context.url.pathname.match(PROFILE_PATH);
  if (m && !(await getProfile(m[1]))) return context.rewrite('/404');
  return next();
};
