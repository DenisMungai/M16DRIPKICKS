import React, { Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequireAuth } from './auth.jsx';
import { Loading } from './components/Async.jsx';

// Route-level code splitting — each page only loads when the route is visited
const Home         = React.lazy(() => import('./pages/Home.jsx'));
const Shop         = React.lazy(() => import('./pages/Shop.jsx'));
const Categories   = React.lazy(() => import('./pages/Categories.jsx'));
const Deals        = React.lazy(() => import('./pages/Deals.jsx'));
const NewArrivals  = React.lazy(() => import('./pages/NewArrivals.jsx'));
const BestSellers  = React.lazy(() => import('./pages/BestSellers.jsx'));
const Brands       = React.lazy(() => import('./pages/Brands.jsx'));
const Collections  = React.lazy(() => import('./pages/Collections.jsx'));
const ProductDetail= React.lazy(() => import('./pages/ProductDetail.jsx'));
const Cart         = React.lazy(() => import('./pages/Cart.jsx'));
const Checkout     = React.lazy(() => import('./pages/Checkout.jsx'));
const OrderDetail  = React.lazy(() => import('./pages/OrderDetail.jsx'));
const Orders       = React.lazy(() => import('./pages/Orders.jsx'));
const Wishlist     = React.lazy(() => import('./pages/Wishlist.jsx'));
const Coupons      = React.lazy(() => import('./pages/Coupons.jsx'));
const Addresses    = React.lazy(() => import('./pages/Addresses.jsx'));
const Settings     = React.lazy(() => import('./pages/Settings.jsx'));
const Login        = React.lazy(() => import('./pages/Login.jsx'));
const Admin        = React.lazy(() => import('./pages/Admin.jsx'));
const Inventory    = React.lazy(() => import('./pages/Inventory.jsx'));
const AdminOrders  = React.lazy(() => import('./pages/AdminOrders.jsx'));
const AdminCoupons = React.lazy(() => import('./pages/AdminCoupons.jsx'));
const Help         = React.lazy(() => import('./pages/Help.jsx'));

const guard = (el, admin = false) => <RequireAuth admin={admin}>{el}</RequireAuth>;

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
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
    </Suspense>
  );
}
