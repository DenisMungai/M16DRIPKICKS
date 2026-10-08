import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import Page from '../components/Page.jsx';
import Field from '../components/Field.jsx';
import { useAuth } from '../auth.jsx';
import { errMsg, fieldErrors } from '../format.js';

export default function Login({ initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode);
  const [params] = useSearchParams();
  const next = params.get('next') && params.get('next').startsWith('/') ? params.get('next') : '/';
  const nav = useNavigate();
  const { user, login, register } = useAuth();
  const [v, setV] = useState({ name: '', email: '', phone: '', password: '' });
  const m = mode === 'login' ? login : register;
  const fe = fieldErrors(m.error);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  if (user && !m.isPending) return <Navigate to={next} replace />;

  const submit = async (e) => {
    e.preventDefault();
    try {
      if (mode === 'login') await login.mutateAsync({ email: v.email, password: v.password });
      else await register.mutateAsync({ name: v.name, email: v.email, password: v.password, phone: v.phone || undefined });
      nav(next, { replace: true });
    } catch { /* shown below */ }
  };

  return (
    <Page>
      <div className="mx-auto max-w-md">
        <h1 className="text-display-sm">{mode === 'login' ? 'Sign in' : 'Create your account'}</h1>
        <p className="mt-2 text-body text-ink-soft">{mode === 'login' ? 'Welcome back. Sign in to check out and track orders.' : 'Save your addresses, wishlist and coupons.'}</p>
        <form onSubmit={submit} noValidate className="card mt-8 space-y-4 p-6">
          {mode === 'register' && <Field label="Full name" value={v.name} onChange={set('name')} error={fe.name} autoComplete="name" />}
          <Field label="Email address" type="email" value={v.email} onChange={set('email')} error={fe.email} autoComplete="email" />
          {mode === 'register' && <Field label="Phone number (optional)" type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" />}
          <Field label="Password" type="password" value={v.password} onChange={set('password')} error={fe.password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} hint={mode === 'register' ? 'At least 8 characters.' : undefined} />
          {m.error && !Object.keys(fe).length && <p role="alert" className="text-small text-sale">{errMsg(m.error)}</p>}
          <button className="btn-primary w-full" disabled={m.isPending}>{m.isPending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-small text-ink-soft">
          {mode === 'login' ? 'New to M16DRIPKICKS?' : 'Already have an account?'}{' '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); m.reset(); }} className="font-medium text-ink underline underline-offset-4">{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
        </p>
      </div>
    </Page>
  );
}
