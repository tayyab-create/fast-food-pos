import { NavLink } from 'react-router-dom';

export function NavBar() {
  return (
    <header className="app-header">
      <h1>Fast Food POS</h1>
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>Cashier</NavLink>
        <NavLink to="/kitchen" className={({ isActive }) => (isActive ? 'active' : '')}>Kitchen</NavLink>
        <NavLink to="/reports" className={({ isActive }) => (isActive ? 'active' : '')}>Reports</NavLink>
        <NavLink to="/menu" className={({ isActive }) => (isActive ? 'active' : '')}>Menu</NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : '')}>Settings</NavLink>
      </nav>
    </header>
  );
}
