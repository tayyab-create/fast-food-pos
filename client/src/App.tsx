import { Route, Routes, useLocation } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { Cashier } from './pages/Cashier';
import { Kitchen } from './pages/Kitchen';
import { Reports } from './pages/Reports';
import { Menu } from './pages/Menu';

export default function App() {
  const { pathname } = useLocation();
  return (
    <>
      <NavBar />
      <main className={['/', '/menu', '/kitchen', '/reports'].includes(pathname) ? 'wide' : undefined}>
        <Routes>
          <Route path="/" element={<Cashier />} />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/menu" element={<Menu />} />
        </Routes>
      </main>
    </>
  );
}
