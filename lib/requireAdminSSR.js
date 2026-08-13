import { getSessionFromReq, createSessionCookie } from './adminAuth';

// Used by every protected admin page: pages/dashboard.js, licenses.js,
// trials.js, settings.js
//   export async function getServerSideProps(context) {
//     return requireAdminSSR(context);
//   }
export function requireAdminSSR(context) {
  const session = getSessionFromReq(context.req);
  if (!session) {
    return {
      redirect: { destination: '/login', permanent: false },
    };
  }
  // Same sliding-expiration refresh as requireAdminApi: visiting any admin
  // page resets the 30-day clock, so a browser that's used regularly never
  // gets logged out just because the original login is old.
  context.res.setHeader('Set-Cookie', createSessionCookie(session, context.req));
  return { props: { username: session.username } };
}
