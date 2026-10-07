import { useState } from 'react';
import { ImagePlus, Plus, X } from 'lucide-react';
import Page from '../components/Page.jsx';
import Modal from '../components/Modal.jsx';
import Field from '../components/Field.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { Query } from '../components/Async.jsx';
import { Pager } from '../components/ui.jsx';
import { errMsg, fieldErrors, money } from '../format.js';
import { useToast } from '../toast.jsx';
import { trpc } from '../trpc.ts';

const stockState = (n, low) => (n === 0 ? 'out' : n < low ? 'low' : 'in');
const toForm = (p) => ({
  id: p?.id, sku: p?.sku ?? '', name: p?.name ?? '', sub: p?.sub ?? '', description: p?.description ?? '',
  category: p?.category ?? '', brand: p?.brand ?? '', price: p?.price ?? '', was: p?.was ?? '', badge: p?.badge ?? '',
  isNew: p?.isNew ?? false, stock: p?.stock ?? 0, image: p?.image ?? '',
  sizes: (p?.sizes ?? []).join(', '), colors: (p?.colors ?? []).map((c) => `${c.name}:${c.swatch}`).join(', '), active: p?.active ?? true,
});

function ProductForm({ product, categories, brands, onDone }) {
  const utils = trpc.useUtils();
  const toast = useToast();
  const [v, setV] = useState(toForm(product));
  const [upErr, setUpErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const done = () => { utils.admin.inventory.invalidate(); utils.catalog.invalidate(); toast.show(product ? 'Product updated' : 'Product created'); onDone(); };
  const create = trpc.admin.productCreate.useMutation({ onSuccess: done });
  const update = trpc.admin.productUpdate.useMutation({ onSuccess: done });
  const m = product ? update : create;
  const fe = fieldErrors(m.error);
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const upload = async (file) => {
    if (!file) return;
    setUpErr(''); setUploading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Upload failed.');
      setV((s) => ({ ...s, image: json.url }));
    } catch (e) { setUpErr(e.message); } finally { setUploading(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    const colors = v.colors.split(',').map((s) => s.trim()).filter(Boolean).map((s) => { const [name, swatch] = s.split(':').map((x) => x.trim()); return { name, swatch: swatch || '#000000' }; });
    const payload = {
      sku: v.sku, name: v.name, sub: v.sub, description: v.description, category: v.category, brand: v.brand || null,
      price: Number(v.price), was: v.was === '' ? null : Number(v.was), badge: v.badge || null, isNew: v.isNew,
      stock: Number(v.stock), image: v.image || null, sizes: v.sizes.split(',').map((s) => s.trim()).filter(Boolean), colors, active: v.active,
    };
    m.mutate(product ? { ...payload, id: product.id } : payload);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" value={v.name} onChange={set('name')} error={fe.name} />
        <Field label="SKU" value={v.sku} onChange={set('sku')} error={fe.sku} />
        <Field className="sm:col-span-2" label="Short description" value={v.sub} onChange={set('sub')} placeholder="Men's road racing shoes" />
        <Field className="sm:col-span-2" as="textarea" rows={3} label="Description" value={v.description} onChange={set('description')} />
        <Field label="Category" value={v.category} onChange={set('category')} error={fe.category} list="cat-list" />
        <Field label="Brand" value={v.brand} onChange={set('brand')} list="brand-list" />
        <Field label="Selling price (KSh)" type="number" min="0" step="1" value={v.price} onChange={set('price')} error={fe.price} />
        <Field label="Previous price (KSh)" type="number" min="0" step="1" value={v.was} onChange={set('was')} hint="Set above the selling price to show a discount. Leave empty to remove the discount." />
        <Field label="Stock" type="number" min="0" step="1" value={v.stock} onChange={set('stock')} error={fe.stock} />
        <Field label="Badge" value={v.badge} onChange={set('badge')} placeholder="New, Last chance…" />
        <Field label="Sizes" value={v.sizes} onChange={set('sizes')} hint="Comma separated: 7, 8, 9 or S, M, L" />
        <Field label="Colours" value={v.colors} onChange={set('colors')} hint="Name:#hex, e.g. Black:#0A0A0A, Bone:#F1EFEA" error={fe['colors.0.swatch'] && 'Use Name:#RRGGBB'} />
      </div>
      <datalist id="cat-list">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="brand-list">{brands.map((c) => <option key={c} value={c} />)}</datalist>

      <div>
        <span className="mb-1.5 block text-small font-medium">Product photo</span>
        <div className="flex items-center gap-4">
          <ProductImage product={{ name: v.name, image: v.image, category: v.category }} className="h-20 w-20 shrink-0 rounded-md border border-line" size="h-8 w-8" />
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary cursor-pointer px-4 py-2.5">
              <ImagePlus className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload photo'}
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            {v.image && <button type="button" onClick={() => setV({ ...v, image: '' })} className="text-small underline underline-offset-4">Remove</button>}
          </div>
        </div>
        <Field className="mt-3" label="…or paste an image URL" value={v.image} onChange={set('image')} error={fe.image} placeholder="https://" />
        {upErr && <p role="alert" className="mt-1 text-micro text-sale">{upErr}</p>}
      </div>

      <div className="flex flex-wrap gap-6 text-small">
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.isNew} onChange={set('isNew')} className="h-4 w-4 accent-black" /> Show in new arrivals</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={v.active} onChange={set('active')} className="h-4 w-4 accent-black" /> Visible in the store</label>
      </div>

      {m.error && !Object.keys(fe).length && <p role="alert" className="text-small text-sale">{errMsg(m.error)}</p>}
      <div className="flex gap-3">
        <button className="btn-primary py-3" disabled={m.isPending}>{m.isPending ? 'Saving…' : product ? 'Save changes' : 'Create product'}</button>
        <button type="button" onClick={onDone} className="btn-secondary py-3">Cancel</button>
      </div>
    </form>
  );
}

export default function Inventory() {
  const [f, setF] = useState({ q: '', category: '', status: '', page: 1 });
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const toast = useToast();
  const utils = trpc.useUtils();
  const cats = trpc.catalog.categories.useQuery();
  const brands = trpc.catalog.brands.useQuery();
  const inv = trpc.admin.inventory.useQuery({ q: f.q || undefined, category: f.category || undefined, status: f.status || undefined, page: f.page, pageSize: 10 }, { placeholderData: (p) => p });
  const hide = trpc.admin.productDelete.useMutation({
    onSuccess: () => { utils.admin.inventory.invalidate(); utils.catalog.invalidate(); toast.show('Product hidden from the store'); },
    onError: (e) => toast.show(errMsg(e)),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });
  const active = f.q || f.category || f.status;

  return (
    <Page title="Inventory management" intro="Overview of all active product stock." wide actions={<button onClick={() => setEditing('new')} className="btn-primary py-3"><Plus className="h-4 w-4" /> Add product</button>}>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-small">
        <input value={f.q} onChange={set('q')} placeholder="Search name or SKU" aria-label="Search products" className="rounded-lg border border-line bg-card px-4 py-2 focus:border-ink focus:outline-none" />
        <select value={f.category} onChange={set('category')} aria-label="Category" className="rounded-lg border border-line bg-card py-2 pl-3 pr-8 font-medium">
          <option value="">All categories</option>
          {(cats.data ?? []).map((c) => <option key={c.slug} value={c.name}>{c.name}</option>)}
        </select>
        <select value={f.status} onChange={set('status')} aria-label="Stock status" className="rounded-lg border border-line bg-card py-2 pl-3 pr-8 font-medium">
          <option value="">Any stock level</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option>
        </select>
        {active && <button onClick={() => setF({ q: '', category: '', status: '', page: 1 })} className="flex items-center gap-1 rounded-full bg-stone px-3 py-1.5 text-micro font-medium"><X className="h-3 w-3" /> Clear all</button>}
      </div>

      <Query q={inv}>
        {(d) => (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-small">
                <thead className="bg-mist text-ink-soft"><tr>{['Product details', 'SKU', 'Category', 'Stock level', 'Unit price', 'Actions'].map((h) => <th key={h} scope="col" className="px-6 py-3 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                  {d.items.map((p) => {
                    const s = stockState(p.stock, d.lowThreshold);
                    return (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-6 py-4"><div className="flex items-center gap-4"><ProductImage product={p} className="h-12 w-12 rounded-md" size="h-6 w-6" /><div><p className="font-semibold">{p.name}</p><p className="text-micro text-ink-soft">{p.sub}</p></div></div></td>
                        <td className="px-6 py-4 text-ink-soft">{p.sku}</td>
                        <td className="px-6 py-4">{p.category}</td>
                        <td className="px-6 py-4">
                          <span className={`font-medium ${s === 'out' ? 'text-sale' : ''}`}>{p.stock} units</span>
                          {s !== 'in' && <span className={`ml-2 rounded-full px-2 py-0.5 text-micro font-semibold ${s === 'out' ? 'bg-sale text-white' : 'border border-ink'}`}>{s === 'out' ? 'Out of stock' : 'Low'}</span>}
                        </td>
                        <td className="px-6 py-4 font-semibold">{money(p.price)}{p.was && <span className="ml-2 font-normal text-ink-faint line-through">{money(p.was)}</span>}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-4 font-medium">
                            <button onClick={() => setEditing(p)} className="underline-offset-4 hover:underline">Edit</button>
                            <button onClick={() => window.confirm(`Hide “${p.name}” from the store? Past orders keep working.`) && hide.mutate({ id: p.id })} className="underline-offset-4 hover:underline">Hide</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {d.items.length === 0 && <tr><td colSpan={6} className="px-6 py-12 text-center text-ink-soft">No products match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-small">
              <p className="text-ink-soft">Showing {d.total ? (d.page - 1) * 10 + 1 : 0} to {Math.min(d.page * 10, d.total)} of {d.total} entries</p>
              <Pager page={d.page} pages={d.pages} onPage={(page) => setF({ ...f, page })} />
            </div>
          </div>
        )}
      </Query>

      {editing && (
        <Modal wide title={editing === 'new' ? 'Add product' : 'Edit product'} onClose={() => setEditing(null)}>
          <ProductForm product={editing === 'new' ? undefined : editing} categories={(cats.data ?? []).map((c) => c.name)} brands={(brands.data ?? []).map((b) => b.name)} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </Page>
  );
}
