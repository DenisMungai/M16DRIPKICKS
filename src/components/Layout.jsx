import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import Footer from './Footer.jsx';

export default function Layout() {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <>
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <Header onMenu={() => setMenu(true)} />
      <Outlet />
      <Footer />
    </>
  );
}
