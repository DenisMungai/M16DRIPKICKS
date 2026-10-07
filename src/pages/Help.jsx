import { Link, useParams } from 'react-router-dom';
import Page from '../components/Page.jsx';

const PAGES = {
  'secure-payment': ['Secure payment', ['Pay with M-Pesa, card or cash on delivery.', 'M-Pesa payments use a prompt sent to your phone, so you only ever enter your PIN on your own handset.', 'Card payments are processed by our payment provider. Card numbers never touch our servers.']],
  returns: ['Easy returns', ['Return unworn items in their original packaging within 14 days of delivery for a refund.', 'Start a return by contacting support with your order number. Refunds go back to your original payment method (M-Pesa refunds are sent to the paying number).']],
  support: ['Contact & locations', []],
  terms: ['Terms of use', ['By placing an order you agree to pay the total shown at checkout, including delivery.', 'Prices are in US dollars. M-Pesa payments are charged in Kenyan shillings at the rate shown before you pay.', 'We may cancel an order if an item is unavailable; paid orders are refunded in full.']],
  privacy: ['Privacy', ['We store the details you give us to process orders: name, email, phone number and delivery addresses.', 'We do not sell your data. Sign-in uses a secure, HTTP-only cookie.']],
  'size-guide': ['Size guide', ['Shoes: sizes are US men’s. If you are between sizes, choose the larger one.', 'Clothing: XS (chest 81–86 cm), S (86–94), M (94–102), L (102–110), XL (110–118).']],
};

export default function Help() {
  const { slug } = useParams();
  const page = PAGES[slug];
  if (!page) return <Page title="Page not found"><Link to="/" className="btn-primary">Back to the store</Link></Page>;
  return (
    <Page title={page[0]}>
      {slug === 'support' ? (
        <div className="card max-w-2xl space-y-6 p-8 text-body text-ink-soft">
          <section>
            <h2 className="font-semibold text-ink">Call or text</h2>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              <a href="tel:0798489436" className="underline underline-offset-4">0798 489 436</a>
              <a href="tel:0769373616" className="underline underline-offset-4">0769 373 616</a>
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold text-ink">Locations</h2>
            <p>Kenyatta University Main Campus (KU), KM, along La Quita Supermarket.</p>
            <p>Pick-up point: Nairobi CBD, Ronald Ngala Street, Royal Palm Mall, Wing B, BM39.</p>
          </section>
        </div>
      ) : (
        <div className="card max-w-2xl space-y-4 p-8 text-body text-ink-soft">
          {page[1].map((p) => <p key={p}>{p}</p>)}
        </div>
      )}
    </Page>
  );
}
