import { Footprints, Shirt, Headphones, Watch, Glasses, ShoppingBag, GlassWater, Armchair, Smile, Dumbbell } from 'lucide-react';

function iconFor(p) {
  if (!p) return ShoppingBag;
  if (/watch/i.test(p.name)) return Watch;
  if (/headphone|WH-|airpods|speaker|jbl/i.test(p.name)) return Headphones;
  if (/shades|wayfarer/i.test(p.name)) return Glasses;
  if (/flask|pour-over/i.test(p.name)) return GlassWater;
  switch (p.category) {
    case 'Footwear': return Footprints;
    case 'Apparel': return Shirt;
    case 'Home & living': return Armchair;
    case 'Beauty': return Smile;
    case 'Equipment': return Dumbbell;
    default: return ShoppingBag;
  }
}

/** Shows the product photo when one is set, otherwise a quiet placeholder. */
export default function ProductImage({ product, className = '', tone = 'bg-mist', size = 'h-16 w-16' }) {
  const Icon = iconFor(product);
  if (product?.image) {
    return (
      <div className={`overflow-hidden ${tone} ${className}`}>
        <img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center ${tone} ${className}`} role="img" aria-label={product?.name || 'Product'}>
      <Icon className={`${size} text-ink-faint`} strokeWidth={1} />
    </div>
  );
}
