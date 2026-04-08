"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import styles from './users.module.css';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Plus, Edit2, Trash2, Shield, ShieldCheck, UserCheck, UserX,
  Eye, EyeOff, BarChart3, Users, IndianRupee, CalendarCheck, Clock, Scissors,
} from 'lucide-react';

interface UserItem {
  id: number; name: string; email: string; phone: string | null; role: string; is_active: number;
}

interface ServiceBreakdown {
  name: string; count: number; revenue: number;
}

interface RecentAppt {
  id: number; customer_name: string; customer_phone: string; date: string;
  time: string; status: string; payment_status: string; total_amount: number;
  paid_amount: number; services: string[]; package_name: string | null;
}

interface StaffPerformance {
  user: { id: number; name: string; email: string; role: string };
  total_appointments: number; total_completed: number; total_customers: number;
  total_revenue: number; services_breakdown: ServiceBreakdown[];
  recent_appointments: RecentAppt[];
}

const getStatusColor = (s: string) => {
  switch (s) { case 'completed': return 'var(--success)'; case 'cancelled': return 'var(--danger)'; case 'booked': return 'var(--primary)'; default: return 'var(--warning)'; }
};
const getPaymentColor = (s: string) => {
  switch (s) { case 'paid': return 'var(--success)'; case 'partial': return 'var(--warning)'; default: return 'var(--danger)'; }
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', role: 'staff' });

  // Staff detail modal
  const [detailData, setDetailData] = useState<StaffPerformance | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { if (currentUser && currentUser.role !== 'admin') router.push('/dashboard'); }, [currentUser, router]);

  const fetchUsers = async () => { try { const res = await api.get('/users/'); setUsers(res.data); } catch {} };
  useEffect(() => { fetchUsers(); }, []);

  const openAddModal = () => { setEditingUser(null); setFormData({ name: '', email: '', phone: '', password: '', role: 'staff' }); setShowPassword(false); setShowModal(true); };
  const openEditModal = (u: UserItem) => { setEditingUser(u); setFormData({ name: u.name, email: u.email, phone: u.phone || '', password: '', role: u.role }); setShowPassword(false); setShowModal(true); };

  const openStaffDetail = async (u: UserItem) => {
    setDetailLoading(true); setDetailData(null);
    try {
      const res = await api.get(`/users/${u.id}/performance`);
      setDetailData(res.data);
      setDetailLoading(false);
    } catch (err: any) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      alert(`Error (${status}): ${detail || err.message}`);
      setDetailLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload: any = { name: formData.name, email: formData.email, phone: formData.phone || null, role: formData.role };
        if (formData.password.trim()) payload.password = formData.password;
        await api.put(`/users/${editingUser.id}`, payload);
      } else { await api.post('/users/', formData); }
      setShowModal(false); setEditingUser(null); fetchUsers();
    } catch (err: any) { alert(err?.response?.data?.detail || 'Error saving user'); }
  };

  const toggleStatus = async (u: UserItem) => {
    if (!confirm(`${u.is_active ? 'Deactivate' : 'Activate'} "${u.name}"?`)) return;
    try { await api.put(`/users/${u.id}/toggle-status`); fetchUsers(); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Permanently delete "${u.name}"?`)) return;
    try { await api.delete(`/users/${u.id}`); fetchUsers(); }
    catch (err: any) { alert(err?.response?.data?.detail || 'Error'); }
  };

  if (currentUser?.role !== 'admin') return null;

  const activeCount = users.filter(u => u.is_active).length;
  const adminCount = users.filter(u => u.role === 'admin').length;
  const staffCount = users.filter(u => u.role === 'staff').length;

  return (
    <div>
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>User Management</h1>
          <p className={dashStyles.pageSubtitle}>Manage staff members, roles & permissions</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddModal}>
          <Plus size={18} /> Add User
        </button>
      </div>

      {/* Stats */}
      <div className={dashStyles.statsGrid} style={{ marginBottom: '1.5rem' }}>
        {[
          { icon: <Shield size={22} />, label: 'Total Users', value: users.length, bg: 'var(--primary-light)', color: 'var(--primary)' },
          { icon: <UserCheck size={22} />, label: 'Active', value: activeCount, bg: 'var(--success-light)', color: 'var(--success)' },
          { icon: <ShieldCheck size={22} />, label: 'Admins', value: adminCount, bg: 'var(--warning-light)', color: 'var(--warning-dark)' },
          { icon: <Shield size={22} />, label: 'Staff', value: staffCount, bg: 'var(--secondary-light)', color: 'var(--secondary)' },
        ].map((s, i) => (
          <div key={i} className={dashStyles.statCard}>
            <div className={dashStyles.statIcon} style={{ background: s.bg, color: s.color }}>{s.icon}</div>
            <div><p className={dashStyles.statLabel}>{s.label}</p><h3 className={dashStyles.statValue}>{s.value}</h3></div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className={dashStyles.statCard} style={{ display: 'block', marginBottom: '1.5rem' }}>
        <div className={custStyles.tableWrapper}>
          <table className={custStyles.table}>
            <thead><tr><th>Full Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: u.role === 'admin' ? 'var(--primary-light)' : 'var(--secondary-light)', color: u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.7rem', fontWeight: 700 }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.name}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                  <td style={{ fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                  <td>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', backgroundColor: u.role === 'admin' ? 'var(--primary-light)' : 'var(--secondary-light)', color: u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)' }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', backgroundColor: u.is_active ? 'var(--success-light)' : 'var(--danger-light)', color: u.is_active ? 'var(--success)' : 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span className={styles.statusDot} style={{ background: u.is_active ? 'var(--success)' : 'var(--danger)' }} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button className={custStyles.actionBtn} onClick={() => openStaffDetail(u)} title="View Performance" style={{ color: 'var(--primary)' }}><BarChart3 size={16} /></button>
                      <button className={custStyles.actionBtn} onClick={() => openEditModal(u)} title="Edit"><Edit2 size={16} /></button>
                      <button className={custStyles.actionBtn} style={{ color: u.is_active ? 'var(--warning)' : 'var(--success)' }} onClick={() => toggleStatus(u)} title={u.is_active ? 'Deactivate' : 'Activate'}>
                        {u.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                      </button>
                      <button className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} onClick={() => handleDelete(u)} title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Staff Performance Modal ═══ */}
      {(detailData || detailLoading) && (
        <div className={custStyles.modalOverlay} onClick={() => setDetailData(null)}>
          <div className={custStyles.modal} style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</div>
            ) : detailData && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: 0 }}>{detailData.user.name}</h2>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>{detailData.user.email} &middot; {detailData.user.role}</p>
                  </div>
                  <button onClick={() => setDetailData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem', padding: '0.25rem' }}>&times;</button>
                </div>

                {/* Performance Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1.5rem' }}>
                  {[
                    { icon: <CalendarCheck size={18} />, label: 'Appointments', value: detailData.total_completed, sub: `${detailData.total_appointments} total`, color: 'var(--primary)' },
                    { icon: <Users size={18} />, label: 'Customers', value: detailData.total_customers, sub: 'served', color: 'var(--secondary)' },
                    { icon: <IndianRupee size={18} />, label: 'Revenue', value: `₹${detailData.total_revenue.toLocaleString()}`, sub: 'earned', color: 'var(--success)' },
                    { icon: <Scissors size={18} />, label: 'Services', value: detailData.services_breakdown.length, sub: 'types', color: 'var(--warning-dark)' },
                  ].map((s, i) => (
                    <div key={i} style={{ background: 'var(--bg-color)', borderRadius: '0.75rem', padding: '0.875rem', textAlign: 'center' }}>
                      <div style={{ color: s.color, marginBottom: '0.35rem' }}>{s.icon}</div>
                      <div style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--text-main)' }}>{s.value}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Services Breakdown */}
                {detailData.services_breakdown.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Services Breakdown</h3>
                    <div style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '0', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0.5rem 0.75rem', background: 'var(--bg-color)', borderBottom: '1px solid var(--border)' }}>
                        <span>Service</span><span style={{ textAlign: 'right' }}>Count</span><span style={{ textAlign: 'right', minWidth: '5rem' }}>Revenue</span>
                      </div>
                      {detailData.services_breakdown.map((s, i) => (
                        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', padding: '0.6rem 0.75rem', borderBottom: i < detailData.services_breakdown.length - 1 ? '1px solid var(--border)' : 'none', fontSize: '0.85rem' }}>
                          <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{s.name}</span>
                          <span style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{s.count}x</span>
                          <span style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)', minWidth: '5rem' }}>₹{s.revenue.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Appointments */}
                {detailData.recent_appointments.length > 0 && (
                  <div style={{ marginTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.75rem' }}>Recent Appointments</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {detailData.recent_appointments.map(a => (
                        <div key={a.id} style={{ background: 'var(--bg-color)', borderRadius: '0.5rem', padding: '0.75rem 1rem', border: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-main)' }}>{a.customer_name}</span>
                              {a.customer_phone && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{a.customer_phone}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', backgroundColor: `${getStatusColor(a.status)}20`, color: getStatusColor(a.status) }}>{a.status}</span>
                              <span style={{ padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', backgroundColor: `${getPaymentColor(a.payment_status)}20`, color: getPaymentColor(a.payment_status) }}>{a.payment_status}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} /> {a.date} at {a.time}</span>
                              <span>{a.package_name ? a.package_name : a.services.join(', ')}</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.875rem' }}>₹{a.total_amount}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailData.total_appointments === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
                    No appointments assigned to this staff member yet.
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                  <button className="btn-primary" style={{ background: 'var(--text-muted)' }} onClick={() => setDetailData(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Add/Edit Modal ═══ */}
      {showModal && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowModal(false); setEditingUser(null); }}>
          <div className={custStyles.modal} style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <h2>{editingUser ? 'Edit User' : 'Add User'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label className="label">Full Name</label>
                <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Email (unique)</label>
                <input type="email" className="input-field" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone No</label>
                <input className="input-field" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="label">{editingUser ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} className="input-field" required={!editingUser} value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} style={{ paddingRight: '2.5rem' }} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)', padding: '0.25rem' }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input-field" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingUser(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingUser ? 'Update' : 'Add User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
