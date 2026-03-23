"use client"
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import styles from './layout.module.css';
import { LayoutDashboard, Users, Scissors, Calendar, CalendarDays, BarChart3, Shield, LogOut, Menu, X } from 'lucide-react';

function LoadingSkeleton() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-color)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1rem',
        }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading SalonPro...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) return <LoadingSkeleton />;

  const isAdmin = user?.role === 'admin';
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const navItems = [
    { name: 'Overview', path: '/dashboard', icon: LayoutDashboard, adminOnly: false },
    { name: 'Customers', path: '/dashboard/customers', icon: Users, adminOnly: false },
    { name: 'Services', path: '/dashboard/services', icon: Scissors, adminOnly: false },
    { name: 'Appointments', path: '/dashboard/appointments', icon: Calendar, adminOnly: false },
    { name: 'Calendar', path: '/dashboard/calendar', icon: CalendarDays, adminOnly: false },
    { name: 'Reports', path: '/dashboard/reports', icon: BarChart3, adminOnly: true },
    { name: 'Users', path: '/dashboard/users', icon: Shield, adminOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className={styles.layout}>
      {/* Mobile Header */}
      <div className={styles.mobileHeader}>
        <div className={styles.brand}>
          <Scissors size={24} />
          <span>SalonPro</span>
        </div>
        <button onClick={toggleSidebar} className={styles.menuBtn}>
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.sidebarHeader}>
          <Scissors size={28} className={styles.brandIcon} />
          <h2>SalonPro</h2>
        </div>

        <nav className={styles.nav}>
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
            return (
              <Link
                href={item.path}
                key={item.name}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={20} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userInfo}>
            <p className={styles.userEmail}>{user?.email}</p>
            <p className={styles.userRole}>{user?.role}</p>
          </div>
          <button onClick={logout} className={styles.logoutBtn}>
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.mainContent}>
        <div className={styles.contentContainer}>
          {children}
        </div>
      </main>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className={styles.overlay} onClick={toggleSidebar} />}
    </div>
  );
}
