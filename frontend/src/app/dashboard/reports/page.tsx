"use client"
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import styles from './reports.module.css';
import {
  BarChart3, TrendingUp, CalendarDays, Star, Users,
  IndianRupee, Trophy, Phone, ArrowUpRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────
interface DailyData { date: string; appointments: number; revenue: number; }
interface DailySummary { total_revenue: number; total_appointments: number; avg_daily_revenue: number; best_day: DailyData | null; }
interface DailyReport { data: DailyData[]; summary: DailySummary; }

interface MonthlyData { month: string; month_num: number; appointments: number; revenue: number; }
interface MonthlySummary { total_revenue: number; total_appointments: number; avg_monthly_revenue: number; best_month: MonthlyData | null; }
interface MonthlyReport { year: number; data: MonthlyData[]; summary: MonthlySummary; }

interface ServiceData { id: number; name: string; category: string; price: number; bookings: number; revenue: number; percentage: number; }
interface ServiceReport { data: ServiceData[]; total_bookings: number; }

interface CustomerData { id: number; name: string; phone: string; visits: number; total_spent: number; last_visit: string | null; avg_spend: number; }
interface CustomerReport { data: CustomerData[]; }

type Tab = 'daily' | 'monthly' | 'services' | 'customers';

// ─── Component ───────────────────────────────────────────────────────
export default function ReportsPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('daily');

  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null);
  const [serviceReport, setServiceReport] = useState<ServiceReport | null>(null);
  const [customerReport, setCustomerReport] = useState<CustomerReport | null>(null);
  const [allServices, setAllServices] = useState<{id: number; name: string; is_length_based?: number; price_short?: number | null; price_extra_long?: number | null}[]>([]);

  // Filters
  const [dailyRange, setDailyRange] = useState(30);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const fetchDaily = async (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    const res = await api.get(`/reports/daily-revenue?start_date=${format(start, 'yyyy-MM-dd')}&end_date=${format(end, 'yyyy-MM-dd')}`);
    setDailyReport(res.data);
  };

  const fetchMonthly = async (year: number) => {
    const res = await api.get(`/reports/monthly-revenue?year=${year}`);
    setMonthlyReport(res.data);
  };

  const fetchServices = async () => {
    const res = await api.get('/reports/popular-services');
    setServiceReport(res.data);
  };

  const fetchCustomers = async () => {
    const res = await api.get('/reports/frequent-customers');
    setCustomerReport(res.data);
  };

  useEffect(() => {
    fetchServices();
    fetchCustomers();
    api.get('/services/all').then(r => setAllServices(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getServicePriceLabel = (s: ServiceData) => {
    const full = allServices.find(sv => sv.id === s.id || sv.name === s.name);
    if (full?.is_length_based) return `₹${full.price_short} – ₹${full.price_extra_long}`;
    return `₹${s.price}`;
  };

  useEffect(() => { fetchDaily(dailyRange); }, [dailyRange]);
  useEffect(() => { fetchMonthly(selectedYear); }, [selectedYear]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'daily', label: 'Daily Revenue', icon: <CalendarDays size={16} /> },
    { key: 'monthly', label: 'Monthly Revenue', icon: <TrendingUp size={16} /> },
    { key: 'services', label: 'Popular Services', icon: <Star size={16} /> },
    { key: 'customers', label: 'Frequent Customers', icon: <Users size={16} /> },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Reports</h1>
          <p className={dashStyles.pageSubtitle}>Revenue analytics, top services & customers</p>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {tabs.map(t => (
          <button key={t.key} className={activeTab === t.key ? styles.tabActive : styles.tab} onClick={() => setActiveTab(t.key)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ DAILY REVENUE ═══════════════════════════════════════════ */}
      {activeTab === 'daily' && dailyReport && (
        <div>
          {/* Filter */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Show last:</span>
            {[7, 14, 30, 60, 90].map(d => (
              <button
                key={d}
                className={dailyRange === d ? styles.tabActive : styles.tab}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setDailyRange(d)}
              >
                {d} days
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Revenue</span>
              <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>₹{dailyReport.summary.total_revenue.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Appointments</span>
              <span className={styles.summaryValue}>{dailyReport.summary.total_appointments}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Avg Daily Revenue</span>
              <span className={styles.summaryValue} style={{ color: 'var(--primary)' }}>₹{dailyReport.summary.avg_daily_revenue.toLocaleString('en-IN')}</span>
            </div>
            {dailyReport.summary.best_day && (
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Best Day</span>
                <span className={styles.summaryValue} style={{ fontSize: '1.1rem' }}>
                  {format(parseISO(dailyReport.summary.best_day.date), 'MMM d')}
                </span>
                <span className={styles.summarySubtext}>₹{dailyReport.summary.best_day.revenue.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><BarChart3 size={18} color="var(--primary)" /> Daily Revenue Chart</div>
            <div className={styles.barChart}>
              {(() => {
                const maxRev = Math.max(...dailyReport.data.map(d => d.revenue), 1);
                return dailyReport.data.map((d, i) => {
                  const hPct = (d.revenue / maxRev) * 75;
                  return (
                    <div key={i} className={styles.barCol} title={`${format(parseISO(d.date), 'MMM d')}: ₹${d.revenue}`}>
                      {d.revenue > 0 && <span className={styles.barValue}>₹{d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue}</span>}
                      <div className={styles.bar} style={{ height: `${Math.max(hPct, 2)}%`, background: d.revenue > 0 ? 'var(--primary)' : 'var(--border)' }} />
                      {dailyRange <= 14 && <span className={styles.barLabel}>{format(parseISO(d.date), 'dd')}</span>}
                      {dailyRange > 14 && i % Math.ceil(dailyReport.data.length / 15) === 0 && (
                        <span className={styles.barLabel}>{format(parseISO(d.date), 'M/d')}</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Daily table */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><IndianRupee size={18} color="var(--success)" /> Daily Breakdown</div>
            <div className={custStyles.tableWrapper} style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className={custStyles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Appointments</th>
                    <th>Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dailyReport.data].reverse().filter(d => d.revenue > 0).map(d => (
                    <tr key={d.date}>
                      <td style={{ fontWeight: 500 }}>{format(parseISO(d.date), 'EEE, MMM d, yyyy')}</td>
                      <td>{d.appointments}</td>
                      <td style={{ fontWeight: 600, color: 'var(--success)' }}>₹{d.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MONTHLY REVENUE ═════════════════════════════════════════ */}
      {activeTab === 'monthly' && monthlyReport && (
        <div>
          {/* Year filter */}
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>Year:</span>
            {years.map(y => (
              <button
                key={y}
                className={selectedYear === y ? styles.tabActive : styles.tab}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setSelectedYear(y)}
              >
                {y}
              </button>
            ))}
          </div>

          {/* Summary */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Yearly Revenue</span>
              <span className={styles.summaryValue} style={{ color: 'var(--success)' }}>₹{monthlyReport.summary.total_revenue.toLocaleString('en-IN')}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Appointments</span>
              <span className={styles.summaryValue}>{monthlyReport.summary.total_appointments}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Avg Monthly Revenue</span>
              <span className={styles.summaryValue} style={{ color: 'var(--primary)' }}>₹{monthlyReport.summary.avg_monthly_revenue.toLocaleString('en-IN')}</span>
            </div>
            {monthlyReport.summary.best_month && (
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Best Month</span>
                <span className={styles.summaryValue} style={{ fontSize: '1.1rem' }}>{monthlyReport.summary.best_month.month}</span>
                <span className={styles.summarySubtext}>₹{monthlyReport.summary.best_month.revenue.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><BarChart3 size={18} color="var(--success)" /> Monthly Revenue – {monthlyReport.year}</div>
            <div className={styles.barChart}>
              {(() => {
                const maxRev = Math.max(...monthlyReport.data.map(d => d.revenue), 1);
                return monthlyReport.data.map((d, i) => {
                  const hPct = (d.revenue / maxRev) * 75;
                  return (
                    <div key={i} className={styles.barCol}>
                      {d.revenue > 0 && <span className={styles.barValue}>₹{d.revenue >= 1000 ? `${(d.revenue / 1000).toFixed(1)}k` : d.revenue}</span>}
                      <div className={styles.bar} style={{ height: `${Math.max(hPct, 2)}%`, background: d.revenue > 0 ? 'var(--success)' : 'var(--border)' }} />
                      <span className={styles.barLabel}>{d.month}</span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* Monthly table */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><IndianRupee size={18} color="var(--success)" /> Monthly Breakdown</div>
            <div className={custStyles.tableWrapper}>
              <table className={custStyles.table}>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Appointments</th>
                    <th>Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyReport.data.map(d => (
                    <tr key={d.month_num}>
                      <td style={{ fontWeight: 500 }}>{d.month} {monthlyReport.year}</td>
                      <td>{d.appointments}</td>
                      <td style={{ fontWeight: 600, color: d.revenue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>₹{d.revenue.toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ POPULAR SERVICES ════════════════════════════════════════ */}
      {activeTab === 'services' && serviceReport && (
        <div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Total Service Bookings</span>
              <span className={styles.summaryValue}>{serviceReport.total_bookings}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>Unique Services Used</span>
              <span className={styles.summaryValue}>{serviceReport.data.length}</span>
            </div>
            {serviceReport.data.length > 0 && (
              <>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Most Popular</span>
                  <span className={styles.summaryValue} style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{serviceReport.data[0].name}</span>
                  <span className={styles.summarySubtext}>{serviceReport.data[0].bookings} bookings</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>Top Revenue Service</span>
                  {(() => { const top = [...serviceReport.data].sort((a, b) => b.revenue - a.revenue)[0]; return (<>
                    <span className={styles.summaryValue} style={{ fontSize: '1.1rem', color: 'var(--success)' }}>{top.name}</span>
                    <span className={styles.summarySubtext}>₹{top.revenue.toLocaleString('en-IN')} revenue</span>
                    <span className={styles.summarySubtext} style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Price: {getServicePriceLabel(top)}</span>
                  </>); })()}
                </div>
              </>
            )}
          </div>

          {/* Services ranking */}
          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Trophy size={18} color="var(--warning)" /> Service Rankings</div>
            {serviceReport.data.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No completed appointments yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {serviceReport.data.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className={styles.rankBadge} style={{
                      background: i === 0 ? 'var(--warning-light)' : i === 1 ? 'var(--bg-color)' : i === 2 ? 'var(--secondary-light)' : 'var(--bg-color)',
                      color: i === 0 ? 'var(--warning-dark)' : i === 1 ? 'var(--text-muted)' : i === 2 ? 'var(--secondary)' : 'var(--text-muted)',
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.name}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.5rem', textTransform: 'uppercase' }}>{s.category}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--primary)', marginLeft: '0.5rem', fontWeight: 500 }}>{getServicePriceLabel(s)}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.bookings} bookings</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--success)', marginLeft: '0.75rem', fontWeight: 600 }}>₹{s.revenue.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${s.percentage}%`, background: i === 0 ? 'var(--primary)' : i === 1 ? 'var(--success)' : 'var(--warning)' }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ FREQUENT CUSTOMERS ══════════════════════════════════════ */}
      {activeTab === 'customers' && customerReport && (
        <div>
          {customerReport.data.length > 0 && (
            <div className={styles.summaryGrid}>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Top Customer</span>
                <span className={styles.summaryValue} style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>{customerReport.data[0].name}</span>
                <span className={styles.summarySubtext}>{customerReport.data[0].visits} visits</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Highest Spender</span>
                <span className={styles.summaryValue} style={{ fontSize: '1.1rem', color: 'var(--success)' }}>
                  {[...customerReport.data].sort((a, b) => b.total_spent - a.total_spent)[0].name}
                </span>
                <span className={styles.summarySubtext}>₹{[...customerReport.data].sort((a, b) => b.total_spent - a.total_spent)[0].total_spent.toLocaleString('en-IN')}</span>
              </div>
              <div className={styles.summaryCard}>
                <span className={styles.summaryLabel}>Highest Avg Spend</span>
                <span className={styles.summaryValue} style={{ fontSize: '1.1rem' }}>
                  ₹{[...customerReport.data].sort((a, b) => b.avg_spend - a.avg_spend)[0].avg_spend.toLocaleString('en-IN')}
                </span>
                <span className={styles.summarySubtext}>{[...customerReport.data].sort((a, b) => b.avg_spend - a.avg_spend)[0].name}</span>
              </div>
            </div>
          )}

          <div className={styles.chartCard}>
            <div className={styles.chartTitle}><Users size={18} color="var(--primary)" /> Customer Rankings (by visits)</div>
            {customerReport.data.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No completed appointments yet</p>
            ) : (
              <div className={custStyles.tableWrapper}>
                <table className={custStyles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Visits</th>
                      <th>Total Spent (₹)</th>
                      <th>Avg Spend (₹)</th>
                      <th>Last Visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerReport.data.map((c, i) => (
                      <tr key={c.id}>
                        <td>
                          <div className={styles.rankBadge} style={{
                            background: i === 0 ? 'var(--warning-light)' : i === 1 ? 'var(--bg-color)' : i === 2 ? 'var(--secondary-light)' : 'var(--bg-color)',
                            color: i === 0 ? 'var(--warning-dark)' : i === 1 ? 'var(--text-muted)' : i === 2 ? 'var(--secondary)' : 'var(--text-muted)',
                          }}>
                            {i + 1}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                            <Phone size={13} color="var(--text-muted)" /> {c.phone}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.visits}</span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>₹{c.total_spent.toLocaleString('en-IN')}</td>
                        <td>₹{c.avg_spend.toLocaleString('en-IN')}</td>
                        <td style={{ fontSize: '0.85rem' }}>
                          {c.last_visit ? format(parseISO(c.last_visit), 'MMM d, yyyy') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
