import {
  Home, LayoutGrid, Tag, Sparkles, Flame, Star, Images,
  ShoppingBag, Heart, Ticket, MapPin, Settings, LayoutDashboard, Boxes, ClipboardList,
  Shirt, Smile, Headphones, Armchair, Dumbbell, Footprints, Glasses,
} from 'lucide-react';

export const mainNav = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/deals', label: 'Deals', icon: Tag, badge: 'Hot' },
  { to: '/new-arrivals', label: 'New arrivals', icon: Sparkles },
  { to: '/best-sellers', label: 'Best sellers', icon: Flame },
  { to: '/brands', label: 'Brands', icon: Star },
  { to: '/collections', label: 'Collections', icon: Images },
];

export const accountNav = [
  { to: '/orders', label: 'My orders', icon: ShoppingBag },
  { to: '/wishlist', label: 'Wishlist', icon: Heart },
  { to: '/coupons', label: 'Coupons', icon: Ticket },
  { to: '/addresses', label: 'Addresses', icon: MapPin },
  { to: '/settings', label: 'Account settings', icon: Settings },
];

export const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/coupons', label: 'Coupons', icon: Ticket },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
];

export const categoryIcons = {
  footwear: Footprints,
  apparel: Shirt,
  accessories: Glasses,
  equipment: Dumbbell,
  electronics: Headphones,
  beauty: Smile,
  'home-living': Armchair,
};
