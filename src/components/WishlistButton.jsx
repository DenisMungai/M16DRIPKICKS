import { Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useToast } from '../toast.jsx';
import { errMsg } from '../format.js';
import { trpc } from '../trpc.ts';

export function useWishlist() {
  const { user } = useAuth();
  const ids = trpc.wishlist.ids.useQuery(undefined, { enabled: !!user });
  return { user, ids: new Set(ids.data ?? []) };
}

export default function WishlistButton({ productId, className = '' }) {
  const { user, ids } = useWishlist();
  const utils = trpc.useUtils();
  const nav = useNavigate();
  const loc = useLocation();
  const toast = useToast();
  const saved = ids.has(productId);

  const toggle = trpc.wishlist.toggle.useMutation({
    onSuccess: (r) => {
      utils.wishlist.ids.invalidate();
      utils.wishlist.list.invalidate();
      toast.show(r.saved ? 'Saved to your wishlist' : 'Removed from your wishlist', r.saved ? { to: '/wishlist', label: 'View' } : undefined);
    },
    onError: (e) => toast.show(errMsg(e)),
  });

  const onClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return nav(`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`);
    toggle.mutate({ productId });
  };

  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      className={`flex h-10 w-10 items-center justify-center rounded-full border border-line bg-card hover:border-ink ${className}`}
    >
      <Heart className={`h-[18px] w-[18px] ${saved ? 'fill-ink' : ''}`} />
    </button>
  );
}
