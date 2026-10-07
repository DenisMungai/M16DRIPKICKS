import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequireAuth } from './auth.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import Categories from './pages/Categories.jsx';
import Deals from './pages/Deals.jsx';
import NewArrivals from './pages/NewArrivals.jsx';
import BestSellers from './pages/BestSellers.jsx';
import Brands from './pages/Brands.jsx';
import Collections from './pages/Collections.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Orders from './pages/Orders.jsx';
import Wishlist from './pages/Wishlist.jsx';
import Coupons from './pages/Coupons.jsx';
import Addresses from './pages/Addresses.jsx';
import Settings from './pages/Settings.jsx';
import Login from './pages/Login.jsx';
import Admin from './pages/Admin.jsx';
import Inventory from './pages/Inventory.jsx';
import AdminOrders from './pages/AdminOrders.jsx';
import AdminCoupons from './pages/AdminCoupons.jsx';
import Help from './pages/Help.jsx';

const guard = (el, admin = false) => <RequireAuth admin={admin}>{el}</RequireAuth>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="shop" element={<Shop />} />
        <Route path="categories" element={<Categories />} />
        <Route path="deals" element={<Deals />} />
        <Route path="new-arrivals" element={<NewArrivals />} />
        <Route path="best-sellers" element={<BestSellers />} />
        <Route path="brands" element={<Brands />} />
        <Route path="collections" element={<Collections />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Login initialMode="register" />} />
        <Route path="help/:slug" element={<Help />} />
        <Route path="checkout" element={guard(<Checkout />)} />
        <Route path="orders" element={guard(<Orders />)} />
        <Route path="orders/:code" element={guard(<OrderDetail />)} />
        <Route path="wishlist" element={<Wishlist />} />
        <Route path="coupons" element={guard(<Coupons />)} />
        <Route path="addresses" element={guard(<Addresses />)} />
        <Route path="settings" element={guard(<Settings />)} />
        <Route path="admin" element={guard(<Admin />, true)} />
        <Route path="admin/inventory" element={guard(<Inventory />, true)} />
        <Route path="admin/coupons" element={guard(<AdminCoupons />, true)} />
        <Route path="admin/orders" element={guard(<AdminOrders />, true)} />
        <Route path="*" element={<Categories />} />
      </Route>
    </Routes>
  );
}
