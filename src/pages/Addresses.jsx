import { useState } from 'react';
import { MapPin, Plus } from 'lucide-react';
import Page from '../components/Page.jsx';
import Modal from '../components/Modal.jsx';
import AddressForm from '../components/AddressForm.jsx';
import { Query } from '../components/Async.jsx';
import { errMsg } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

export default function Addresses() {
  const list = trpc.addresses.list.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | address
  const refresh = () => utils.addresses.list.invalidate();
  const fail = (e) => toast.show(errMsg(e));
  const remove = trpc.addresses.remove.useMutation({ onSuccess: refresh, onError: fail });
  const makeDefault = trpc.addresses.setDefault.useMutation({ onSuccess: refresh, onError: fail });

  return (
    <Page
      title="Addresses"
      intro="Manage your delivery addresses."
      actions={<button onClick={() => setEditing('new')} className="btn-primary py-3"><Plus className="h-4 w-4" /> Add new address</button>}
    >
      <Query q={list}>
        {(addresses) => (
          <div className="grid gap-gutter md:grid-cols-2">
            {addresses.map((a) => (
              <article key={a.id} className={`card flex flex-col p-6 ${a.isDefault ? 'border-ink' : ''}`}>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-title">{a.label}</h2>
                  {a.isDefault && <span className="rounded-sm bg-ink px-2 py-1 text-micro font-medium text-white">Default</span>}
                </div>
                <address className="flex-1 text-small not-italic leading-6 text-ink-soft">
                  {[a.name, a.line1, a.line2, `${a.city}, ${a.country}`, a.phone].filter(Boolean).map((l) => <span key={l} className="block">{l}</span>)}
                </address>
                <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 text-small font-medium">
                  <button onClick={() => setEditing(a)} className="underline-offset-4 hover:underline">Edit</button>
                  <button onClick={() => window.confirm('Delete this address?') && remove.mutate({ id: a.id })} className="underline-offset-4 hover:underline">Delete</button>
                  {!a.isDefault && <button onClick={() => makeDefault.mutate({ id: a.id })} className="ml-auto underline-offset-4 hover:underline">Set as default</button>}
                </div>
              </article>
            ))}
            <button onClick={() => setEditing('new')} className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-ink-faint bg-card text-center hover:border-ink">
              <MapPin className="h-6 w-6" />
              <span className="text-title">Add new address</span>
              <span className="text-small text-ink-soft">Add a delivery location to your account.</span>
            </button>
          </div>
        )}
      </Query>
      {editing && (
        <Modal title={editing === 'new' ? 'Add address' : 'Edit address'} onClose={() => setEditing(null)}>
          <AddressForm address={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        </Modal>
      )}
    </Page>
  );
}
