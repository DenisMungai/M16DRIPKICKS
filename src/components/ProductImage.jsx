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

/**
 * Shows the product photo when one is set, otherwise a quiet placeholder.
 * Fix 2: Uses <picture> to serve WebP to capable browsers with a JPEG/PNG fallback.
 */
export default function ProductImage({ product, className = '', tone = 'bg-mist', size = 'h-16 w-16' }) {
  const Icon = iconFor(product);
  if (product?.image) {
    // Derive the WebP sibling path: "/products/foo.jpg" → "/products/foo.webp"
    const webpSrc = product.image.replace(/\.(jpe?g|png)$/i, '.webp');
    const hasWebp = webpSrc !== product.image; // only add <source> when extension changed
    return (
      <div className={`overflow-hidden ${tone} ${className}`}>
        <picture>
          {hasWebp && <source srcSet={webpSrc} type="image/webp" />}
          <img
            src={product.image}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </picture>
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center ${tone} ${className}`} role="img" aria-label={product?.name || 'Product'}>
      <Icon className={`${size} text-ink-faint`} strokeWidth={1} />
    </div>
  );
}
