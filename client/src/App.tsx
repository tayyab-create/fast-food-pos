import { Link, Route, Routes } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { Cashier } from './pages/Cashier';
import { Kitchen } from './pages/Kitchen';
import { Reports } from './pages/Reports';
import { Menu } from './pages/Menu';
import { Settings } from './pages/Settings';

function NotFound() {
  return (
    <p className="empty">
      There's no page at this address. <Link to="/">Back to the Cashier</Link>
    </p>
  );
}

export default function App() {
  return (
    <>
      <NavBar />
      <main className="wide">
        <Routes>
          <Route path="/" element={<Cashier />} />
          <Route path="/kitchen" element={<Kitchen />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
