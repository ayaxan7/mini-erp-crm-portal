import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Badge, statusTone } from '../ui/Badge';
import { LogOutIcon, GridIcon, UsersIcon, BoxIcon, DocumentIcon, KeyIcon } from '../ui/Icons';
import styles from './AppShell.module.css';

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <GridIcon /> },
    { to: '/customers', label: 'Customers', icon: <UsersIcon /> },
    { to: '/products', label: 'Products', icon: <BoxIcon /> },
    { to: '/challans', label: 'Challans', icon: <DocumentIcon /> },
  ];

  if (user.role === 'ADMIN') {
    navItems.push({ to: '/access-requests', label: 'Access requests', icon: <KeyIcon /> });
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.brandRow}>
          <span className={styles.logo}>M<span className="brand-accent">.</span>ERP</span>
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
              onClick={() => setOpen(false)}
              end={item.to === '/'}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.user}>
            <div className={styles.avatar}>{user.name.charAt(0).toUpperCase()}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{user.name}</span>
              <Badge tone={statusTone(user.role)}>{user.role}</Badge>
            </div>
          </div>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            <LogOutIcon />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {open && <div className={styles.scrim} onClick={() => setOpen(false)} />}

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button type="button" className={styles.menuButton} onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <div className={styles.topbarTitle}>
            <span className="brand">Mini ERP + CRM</span>
            <span className={styles.topbarSub}>Operations Portal</span>
          </div>
          <div className={styles.topbarRight}>
            <Badge tone={statusTone(user.role)}>{user.role}</Badge>
            <span className={styles.topbarName}>{user.name.split(' ')[0]}</span>
          </div>
        </header>
        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}