import { useState } from 'react';
import { Plus, Ticket } from 'lucide-react';
import Field from '../components/Field.jsx';
import Modal from '../components/Modal.jsx';
import Page from '../components/Page.jsx';
import { Query } from '../components/Async.jsx';
import { date, errMsg, fieldErrors, money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const emptyForm = {
  code: '', tag: 'Offer', title: '', note: '', type: 'percent', value: '',
  minSpend: '0', expiresAt: '', onePerUser: false, autoGrant: false, active: true,
};

function CouponForm({ onDone }) {
  const [form, setForm] = useState(emptyForm);
  const utils = trpc.useUtils();
  const toast = useToast();
  const create = trpc.admin.couponCreate.useMutation({
    onSuccess: (coupon) => {
      utils.admin.coupons.invalidate();
      toast.show(`${coupon.code} created`);
      onDone();
    },
  });
  const errors = fieldErrors(create.error);
  const set = (key) => (event) => setForm({
    ...form,
    [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
  });

  const submit = (event) => {
    event.preventDefault();
    create.mutate({
      ...form,
      value: form.type === 'freeship' ? 0 : Number(form.value),
      minSpend: Number(form.minSpend),
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59.999Z`).toISOString() : null,
      active: form.active,
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Coupon code" value={form.code} onChange={set('code')} error={errors.code} placeholder="SPRING20" />
        <Field label="Display tag" value={form.tag} onChange={set('tag')} error={errors.tag} placeholder="Seasonal offer" />
        <Field className="sm:col-span-2" label="Offer title" value={form.title} onChange={set('title')} error={errors.title} />
        <Field className="sm:col-span-2" as="textarea" rows={2} label="Customer note" value={form.note} onChange={set('note')} error={errors.note} />
        <Field as="select" label="Discount type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, value: '' })}>
          <option value="percent">Percentage off</option>
          <option value="fixed">Fixed amount off</option>
          <option value="freeship">Free shipping</option>
        </Field>
        {form.type !== 'freeship' && (
          <Field
            label={form.type === 'percent' ? 'Percentage off' : 'Amount off (KSh)'}
            type="number"
            min={form.type === 'percent' ? 1 : 1}
            max={form.type === 'percent' ? 100 : 100000}
            step="1"
            value={form.value}
            onChange={set('value')}
            error={errors.value}
            hint={form.type === 'percent' ? 'Enter a value from 1 to 100.' : 'The amount is converted to the store’s internal currency.'}
          />
        )}
        <Field label="Minimum spend (KSh)" type="number" min="0" step="1" value={form.minSpend} onChange={set('minSpend')} error={errors.minSpend} />
        <Field label="Expiry date (optional)" type="date" value={form.expiresAt} onChange={set('expiresAt')} error={errors.expiresAt} hint="Valid through the end of the selected date." />
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 text-small">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.onePerUser} onChange={set('onePerUser')} className="h-4 w-4 accent-black" />
          One use per customer
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.autoGrant} onChange={set('autoGrant')} className="h-4 w-4 accent-black" />
          Add to customer coupon wallets
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.active} onChange={set('active')} className="h-4 w-4 accent-black" />
          Active immediately
        </label>
      </div>

      {create.error && !Object.keys(errors).length && <p role="alert" className="text-small text-sale">{errMsg(create.error)}</p>}
      <div className="flex gap-3">
        <button className="btn-primary py-3" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create coupon'}</button>
        <button type="button" onClick={onDone} className="btn-secondary py-3">Cancel</button>
      </div>
    </form>
  );
}

export default function AdminCoupons() {
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  const toast = useToast();
  const coupons = trpc.admin.coupons.useQuery();
  const setActive = trpc.admin.couponSetActive.useMutation({
    onSuccess: (coupon) => {
      utils.admin.coupons.invalidate();
      toast.show(`${coupon.code} ${coupon.active ? 'activated' : 'deactivated'}`);
    },
    onError: (error) => toast.show(errMsg(error)),
  });

  return (
    <Page
      title="Coupon management"
      intro="Create discount codes customers can claim and use at checkout."
      wide
      actions={<button onClick={() => setCreating(true)} className="btn-primary py-3"><Plus className="h-4 w-4" /> Create coupon</button>}
    >
      <Query q={coupons}>
        {(items) => (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-small">
                <thead className="bg-mist text-ink-soft">
                  <tr>{['Coupon', 'Discount', 'Eligibility', 'Status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-6 py-3 font-medium">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {items.map((coupon) => (
                    <tr key={coupon.id} className="border-t border-line">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-3">
                          <Ticket className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                          <div>
                            <p className="font-semibold">{coupon.code}</p>
                            <p className="text-ink-soft">{coupon.title}</p>
                            {coupon.note && <p className="mt-1 max-w-sm text-micro text-ink-faint">{coupon.note}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium">
                          {coupon.type === 'percent' ? `${coupon.value}% off` : coupon.type === 'fixed' ? `${money(coupon.value)} off` : 'Free shipping'}
                        </span>
                        <p className="text-micro text-ink-soft">{coupon.tag}</p>
                      </td>
                      <td className="px-6 py-4 text-ink-soft">
                        <p>{coupon.minSpend > 0 ? `Minimum ${money(coupon.minSpend)}` : 'No minimum spend'}</p>
                        <p>{coupon.expiresAt ? `Expires ${date(coupon.expiresAt)}` : 'No expiry'}</p>
                        {coupon.onePerUser && <p>One use per customer</p>}
                        {coupon.autoGrant && <p>Auto-granted</p>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-micro font-medium ${coupon.active ? 'bg-ink text-white' : 'bg-stone text-ink-soft'}`}>
                          {coupon.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setActive.mutate({ id: coupon.id, active: !coupon.active })}
                          disabled={setActive.isPending}
                          className="font-medium underline-offset-4 hover:underline disabled:opacity-50"
                        >
                          {coupon.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && <tr><td colSpan={5} className="px-6 py-12 text-center text-ink-soft">No coupons yet. Create one to get started.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Query>

      {creating && <Modal title="Create coupon" onClose={() => setCreating(false)}><CouponForm onDone={() => setCreating(false)} /></Modal>}
    </Page>
  );
}
