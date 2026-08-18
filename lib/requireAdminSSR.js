import { getSessionFromReq } from './adminAuth';

// Used by every protected admin page: pages/dashboard.js, licenses.js, trials.js
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
  return { props: { username: session.username } };
}
