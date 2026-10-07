import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from './components/Async.jsx';
import Page from './components/Page.jsx';
import { trpc } from './trpc.ts';

export function useAuth() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const refresh = () => utils.invalidate();
  const login = trpc.auth.login.useMutation({ onSuccess: refresh });
  const register = trpc.auth.register.useMutation({ onSuccess: refresh });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: async () => { await utils.auth.me.reset(); utils.invalidate(); } });
  return { user: me.data ?? null, loading: me.isLoading, login, register, logout: logoutMutation };
}

export function RequireAuth({ admin = false, children }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Page><Loading /></Page>;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (admin && user.role !== 'admin') {
    return (
      <Page title="Admin only" intro="Your account does not have access to this area." />
    );
  }
  return children;
}
