"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import styles from './dashboard.module.css';
import custStyles from './customers/customers.module.css';
import {
  Users, CalendarCheck, TrendingUp, IndianRupee, Clock,
  CalendarDays, Activity, Crown, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';

interface RevenueDay {
  date: string;
  revenue: number;
}
interface CustomerMonth {
  month: string;
  count: number;
}
interface RecentItem {
  id: number;
  customer_name: string;
  date: string;
  time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  services: string[];
  staff_name: string | null;
}
interface TopCustomer {
  name: string;
  visits: number;
  spent: number;
}
interface DashboardStats {
  total_customers: number;
  appointments_today: number;
  upcoming_appointments: number;
  total_revenue: number;
  revenue_today: number;
  revenue_month: number;
  revenue_7days: RevenueDay[];
  customer_growth: CustomerMonth[];
  recent_activity: RecentItem[];
  top_customers: TopCustomer[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'var(--success)';
    case 'cancelled': return 'var(--danger)';
    case 'pending': return 'var(--warning)';
    case 'booked': return 'var(--primary)';
    default: return 'var(--warning)';
  }
};

const getPaymentColor = (status: string) => {
  switch (status) {
    case 'paid': return 'var(--success)';
    case 'partial': return 'var(--warning)';
    default: return 'var(--danger)';
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/dashboard/stats');
        setStats(res.data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading || !stats) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '2rem', height: '2rem', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 0.75rem' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading dashboard...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );

  const maxRevenue = Math.max(...stats.revenue_7days.map(d => d.revenue), 1);
  const maxCustomerCount = Math.max(...stats.customer_growth.map(d => d.count), 1);

  return (
    <div>
      <h1 className={styles.pageTitle}>Dashboard Overview</h1>
      <p className={styles.pageSubtitle}>Welcome back. Here is what is happening today.</p>

      {/* ── Stat Cards ──────────────────────────────────────────────── */}
      <div className={styles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard} onClick={() => router.push('/dashboard/customers')} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon} style={{ backgroundColor: 'var(--secondary-light)', color: 'var(--secondary)' }}>
            <Users size={24} />
          </div>
          <div>
            <p className={styles.statLabel}>Total Customers</p>
            <h3 className={styles.statValue}>{stats.total_customers}</h3>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => router.push('/dashboard/appointments')} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon} style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className={styles.statLabel}>Today&apos;s Appointments</p>
            <h3 className={styles.statValue}>{stats.appointments_today}</h3>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => router.push('/dashboard/calendar')} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon} style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning-dark)' }}>
            <CalendarDays size={24} />
          </div>
          <div>
            <p className={styles.statLabel}>Upcoming Appointments</p>
            <h3 className={styles.statValue}>{stats.upcoming_appointments}</h3>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => router.push('/dashboard/reports')} style={{ cursor: 'pointer' }}>
          <div className={styles.statIcon} style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <IndianRupee size={24} />
          </div>
          <div>
            <p className={styles.statLabel}>Total Revenue</p>
            <h3 className={styles.statValue}>₹{stats.total_revenue.toLocaleString('en-IN')}</h3>
          </div>
        </div>
      </div>

      {/* ── Revenue Summary Row ─────────────────────────────────────── */}
      <div className={styles.gridTwo} style={{ marginBottom: '1.5rem' }}>
        <div className={styles.statCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
            <p className={styles.statLabel}>Revenue Today</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--success)', fontSize: '0.8rem', fontWeight: 600 }}>
              <ArrowUpRight size={14} /> Today
            </div>
          </div>
          <h3 className={styles.statValue} style={{ color: 'var(--success)' }}>₹{stats.revenue_today.toLocaleString('en-IN')}</h3>
        </div>
        <div className={styles.statCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', justifyContent: 'space-between' }}>
            <p className={styles.statLabel}>Revenue This Month</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', color: 'var(--primary)', fontSize: '0.8rem', fontWeight: 600 }}>
              <TrendingUp size={14} /> Month
            </div>
          </div>
          <h3 className={styles.statValue} style={{ color: 'var(--primary)' }}>₹{stats.revenue_month.toLocaleString('en-IN')}</h3>
        </div>
      </div>

      {/* ── Charts Row ──────────────────────────────────────────────── */}
      <div className={styles.gridTwo} style={{ marginBottom: '1.5rem' }}>
        {/* Revenue Chart (Last 7 Days) */}
        <div className={styles.statCard} style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <TrendingUp size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Revenue (Last 7 Days)</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '140px', padding: '0 0.25rem' }}>
            {stats.revenue_7days.map((d, i) => {
              const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 120 : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {d.revenue > 0 ? `₹${d.revenue.toLocaleString('en-IN')}` : ''}
                  </span>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(height, 4)}px`,
                    background: d.revenue > 0 ? 'var(--primary)' : 'var(--border)',
                    borderRadius: '0.25rem 0.25rem 0 0',
                    transition: 'height 0.3s',
                  }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    {format(parseISO(d.date), 'EEE')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Customer Growth Chart (Last 6 Months) */}
        <div className={styles.statCard} style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={18} color="var(--secondary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>New Customers (6 Months)</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '140px', padding: '0 0.25rem' }}>
            {stats.customer_growth.map((d, i) => {
              const height = maxCustomerCount > 0 ? (d.count / maxCustomerCount) * 120 : 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <div style={{
                    width: '100%',
                    height: `${Math.max(height, 4)}px`,
                    background: d.count > 0 ? 'var(--secondary)' : 'var(--border)',
                    borderRadius: '0.25rem 0.25rem 0 0',
                    transition: 'height 0.3s',
                  }} />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                    {d.month.split(' ')[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Recent Activity + Top Customers ──────────── */}
      <div className={styles.gridSidebar}>
        {/* Recent Activity */}
        <div className={styles.statCard} style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Activity size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Recent Activity</h3>
          </div>
          {/* Desktop table view */}
          <div className={styles.activityTable}>
            <div className={custStyles.tableWrapper}>
              <table className={custStyles.table}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Date & Time</th>
                    <th>Services</th>
                    <th>Staff</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_activity.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No recent activity</td></tr>
                  ) : stats.recent_activity.map(a => (
                    <tr key={a.id}>
                      <td style={{ fontWeight: 500 }}>{a.customer_name}</td>
                      <td>
                        <div style={{ fontSize: '0.8rem' }}>
                          <div>{format(parseISO(a.date), 'MMM d, yyyy')}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{a.time}</div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {a.services.join(', ')}
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>{a.staff_name || '—'}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          backgroundColor: `${getStatusColor(a.status)}20`,
                          color: getStatusColor(a.status),
                          textTransform: 'uppercase',
                        }}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          backgroundColor: `${getPaymentColor(a.payment_status)}20`,
                          color: getPaymentColor(a.payment_status),
                          textTransform: 'uppercase',
                        }}>
                          {a.payment_status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '0.85rem' }}>₹{a.total_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card view */}
          <div className={styles.activityCards}>
            {stats.recent_activity.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No recent activity</p>
            ) : stats.recent_activity.map(a => (
              <div key={a.id} className={styles.activityCard}>
                <div className={styles.activityCardHeader}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{a.customer_name}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>₹{a.total_amount}</span>
                </div>
                <div className={styles.activityCardBody}>
                  <div className={styles.activityCardRow}>
                    <span className={styles.activityCardLabel}>Date</span>
                    <span>{format(parseISO(a.date), 'MMM d, yyyy')} · {a.time}</span>
                  </div>
                  <div className={styles.activityCardRow}>
                    <span className={styles.activityCardLabel}>Services</span>
                    <span style={{ textAlign: 'right' }}>{a.services.join(', ')}</span>
                  </div>
                  <div className={styles.activityCardRow}>
                    <span className={styles.activityCardLabel}>Staff</span>
                    <span>{a.staff_name || '—'}</span>
                  </div>
                  <div className={styles.activityCardRow}>
                    <span className={styles.activityCardLabel}>Status</span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        backgroundColor: `${getStatusColor(a.status)}20`,
                        color: getStatusColor(a.status),
                        textTransform: 'uppercase',
                      }}>
                        {a.status}
                      </span>
                      <span style={{
                        padding: '0.15rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        backgroundColor: `${getPaymentColor(a.payment_status)}20`,
                        color: getPaymentColor(a.payment_status),
                        textTransform: 'uppercase',
                      }}>
                        {a.payment_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Customers */}
        <div className={styles.statCard} style={{ display: 'block', alignSelf: 'start' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Crown size={18} color="var(--warning)" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>Top Customers</h3>
          </div>
          {stats.top_customers.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No data yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {stats.top_customers.map((c, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  border: '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  transition: 'background 0.15s',
                }}>
                  <div style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    background: i === 0 ? 'var(--warning-light)' : i === 1 ? 'var(--bg-color)' : i === 2 ? 'var(--secondary-light)' : 'var(--bg-color)',
                    color: i === 0 ? 'var(--warning-dark)' : i === 1 ? 'var(--text-muted)' : i === 2 ? 'var(--secondary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.visits} visits</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '0.9rem' }}>
                    ₹{c.spent.toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
