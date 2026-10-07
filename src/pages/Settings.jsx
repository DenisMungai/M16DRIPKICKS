import { useState } from 'react';
import { Link } from 'react-router-dom';
import Page from '../components/Page.jsx';
import Field from '../components/Field.jsx';
import { Loading } from '../components/Async.jsx';
import { useAuth } from '../auth.jsx';
import { errMsg, fieldErrors } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const tabs = ['Profile', 'Security', 'Shipping', 'Payment methods'];

function Profile({ user, mpesaOnly = false }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [v, setV] = useState({ name: user.name, email: user.email, phone: user.phone ?? '', mpesaPhone: user.mpesaPhone ?? '' });
  const m = trpc.auth.updateProfile.useMutation({ onSuccess: () => { utils.auth.me.invalidate(); toast.show('Saved'); } });
  const fe = fieldErrors(m.error);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); m.mutate({ ...v, phone: v.phone || undefined, mpesaPhone: v.mpesaPhone || undefined }); }} noValidate className="space-y-6">
      <h2 className="text-title">{mpesaOnly ? 'M-Pesa' : 'Profile information'}</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        {!mpesaOnly && <>
          <Field label="Full name" value={v.name} onChange={set('name')} error={fe.name} autoComplete="name" />
          <Field label="Email address" type="email" value={v.email} onChange={set('email')} error={fe.email} autoComplete="email" />
          <Field label="Phone number" type="tel" value={v.phone} onChange={set('phone')} autoComplete="tel" />
        </>}
        <Field label="Default M-Pesa number" type="tel" value={v.mpesaPhone} onChange={set('mpesaPhone')} placeholder="0712 345 678" hint="Pre-filled when you pay with M-Pesa." />
      </div>
      {m.error && !Object.keys(fe).length && <p role="alert" className="text-small text-sale">{errMsg(m.error)}</p>}
      <button className="btn-primary" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
}

function Security() {
  const toast = useToast();
  const [v, setV] = useState({ current: '', next: '', confirm: '' });
  const [mismatch, setMismatch] = useState(false);
  const m = trpc.auth.changePassword.useMutation({ onSuccess: () => { setV({ current: '', next: '', confirm: '' }); toast.show('Password updated'); } });
  const fe = fieldErrors(m.error);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.next !== v.confirm) return setMismatch(true); setMismatch(false); m.mutate({ current: v.current, next: v.next }); }} noValidate className="max-w-md space-y-5">
      <h2 className="text-title">Security and password</h2>
      <Field label="Current password" type="password" value={v.current} onChange={set('current')} autoComplete="current-password" />
      <Field label="New password" type="password" value={v.next} onChange={set('next')} error={fe.next} autoComplete="new-password" hint="At least 8 characters." />
      <Field label="Confirm new password" type="password" value={v.confirm} onChange={set('confirm')} error={mismatch ? 'The passwords do not match.' : undefined} autoComplete="new-password" />
      {m.error && !Object.keys(fe).length && <p role="alert" className="text-small text-sale">{errMsg(m.error)}</p>}
      <button className="btn-primary" disabled={m.isPending}>{m.isPending ? 'Updating…' : 'Update password'}</button>
    </form>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState(tabs[0]);
  if (!user) return <Page title="Account settings"><Loading /></Page>;
  return (
    <Page title="Account settings" intro="Manage your profile, security and payment details.">
      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto lg:flex-col">
          {tabs.map((t) => <button key={t} onClick={() => setTab(t)} aria-current={tab === t} className={`whitespace-nowrap rounded-lg px-4 py-3 text-left text-small font-medium transition-colors ${tab === t ? 'bg-ink text-white' : 'text-ink-soft hover:bg-stone hover:text-ink'}`}>{t}</button>)}
        </nav>
        <section className="card p-8">
          {tab === 'Profile' && <Profile user={user} />}
          {tab === 'Security' && <Security />}
          {tab === 'Shipping' && (
            <div className="space-y-4">
              <h2 className="text-title">Shipping addresses</h2>
              <p className="text-body text-ink-soft">Add, edit and choose your default delivery address.</p>
              <Link to="/addresses" className="btn-primary">Manage addresses</Link>
            </div>
          )}
          {tab === 'Payment methods' && (
            <div className="space-y-8">
              <Profile user={user} mpesaOnly />
              <div className="border-t border-line pt-6">
                <h2 className="text-title">Cards</h2>
                <p className="mt-2 text-body text-ink-soft">Card payments are handled by our payment provider. We never see or store your card details.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
