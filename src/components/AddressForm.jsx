import { useState } from 'react';
import Field from './Field.jsx';
import { errMsg, fieldErrors } from '../format.js';
import { trpc } from '../trpc.ts';

const empty = { label: 'Home', name: '', phone: '', line1: '', line2: '', city: '', country: 'Kenya' };

export default function AddressForm({ address, onDone, onCancel }) {
  const utils = trpc.useUtils();
  const [v, setV] = useState(address ? { ...empty, ...address, line2: address.line2 ?? '' } : empty);
  const done = () => { utils.addresses.list.invalidate(); onDone?.(); };
  const create = trpc.addresses.create.useMutation({ onSuccess: done });
  const update = trpc.addresses.update.useMutation({ onSuccess: done });
  const m = address ? update : create;
  const fe = fieldErrors(m.error);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    const payload = { label: v.label, name: v.name, phone: v.phone, line1: v.line1, line2: v.line2 || null, city: v.city, country: v.country };
    m.mutate(address ? { ...payload, id: address.id } : payload);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Label" value={v.label} onChange={set('label')} error={fe.label} placeholder="Home, Office…" />
        <Field label="Full name" value={v.name} onChange={set('name')} error={fe.name} autoComplete="name" />
        <Field label="Phone number" type="tel" value={v.phone} onChange={set('phone')} error={fe.phone} autoComplete="tel" />
        <Field label="City" value={v.city} onChange={set('city')} error={fe.city} autoComplete="address-level2" />
        <Field className="sm:col-span-2" label="Street address" value={v.line1} onChange={set('line1')} error={fe.line1} autoComplete="address-line1" />
        <Field className="sm:col-span-2" label="Apartment, building (optional)" value={v.line2} onChange={set('line2')} autoComplete="address-line2" />
        <Field label="Country" value={v.country} onChange={set('country')} error={fe.country} autoComplete="country-name" />
      </div>
      {m.error && !Object.keys(fe).length && <p role="alert" className="text-small text-sale">{errMsg(m.error)}</p>}
      <div className="flex gap-3">
        <button className="btn-primary py-3" disabled={m.isPending}>{m.isPending ? 'Saving…' : 'Save address'}</button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary py-3">Cancel</button>}
      </div>
    </form>
  );
}
