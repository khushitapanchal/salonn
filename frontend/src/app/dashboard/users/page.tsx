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
  Eye, EyeOff,
} from 'lucide-react';

interface UserItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  is_active: number;
}


export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'staff',
  });

  // Guard: only admin can access
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [currentUser, router]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users/');
      setUsers(res.data);
    } catch {
      // If not admin, API returns 403
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAddModal = () => {
    setEditingUser(null);
    setFormData({ name: '', email: '', phone: '', password: '', role: 'staff' });
    setShowPassword(false);
    setShowModal(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setFormData({
      name: u.name,
      email: u.email,
      phone: u.phone || '',
      password: '',
      role: u.role,
    });
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        const payload: any = {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          role: formData.role,
        };
        if (formData.password.trim()) {
          payload.password = formData.password;
        }
        await api.put(`/users/${editingUser.id}`, payload);
      } else {
        await api.post('/users/', formData);
      }
      setShowModal(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Error saving user';
      alert(detail);
    }
  };

  const toggleStatus = async (u: UserItem) => {
    const action = u.is_active ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} "${u.name}"?`)) return;
    try {
      await api.put(`/users/${u.id}/toggle-status`);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error updating status');
    }
  };

  const handleDelete = async (u: UserItem) => {
    if (!confirm(`Are you sure you want to permanently delete "${u.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      fetchUsers();
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Error deleting user');
    }
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
        <div className={dashStyles.statCard}>
          <div className={dashStyles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Shield size={22} />
          </div>
          <div>
            <p className={dashStyles.statLabel}>Total Users</p>
            <h3 className={dashStyles.statValue}>{users.length}</h3>
          </div>
        </div>
        <div className={dashStyles.statCard}>
          <div className={dashStyles.statIcon} style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <UserCheck size={22} />
          </div>
          <div>
            <p className={dashStyles.statLabel}>Active Users</p>
            <h3 className={dashStyles.statValue}>{activeCount}</h3>
          </div>
        </div>
        <div className={dashStyles.statCard}>
          <div className={dashStyles.statIcon} style={{ background: 'var(--warning-light)', color: 'var(--warning-dark)' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className={dashStyles.statLabel}>Admins</p>
            <h3 className={dashStyles.statValue}>{adminCount}</h3>
          </div>
        </div>
        <div className={dashStyles.statCard}>
          <div className={dashStyles.statIcon} style={{ background: 'var(--secondary-light)', color: 'var(--secondary)' }}>
            <Shield size={22} />
          </div>
          <div>
            <p className={dashStyles.statLabel}>Staff</p>
            <h3 className={dashStyles.statValue}>{staffCount}</h3>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className={dashStyles.statCard} style={{ display: 'block', marginBottom: '1.5rem' }}>
        <div className={custStyles.tableWrapper}>
          <table className={custStyles.table}>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>No users found.</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '2rem', height: '2rem', borderRadius: '50%',
                        background: u.role === 'admin' ? 'var(--primary-light)' : 'var(--secondary-light)',
                        color: u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, fontSize: '0.7rem', fontWeight: 700,
                      }}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.name}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                  <td style={{ fontSize: '0.85rem' }}>{u.phone || '—'}</td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '9999px',
                      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                      backgroundColor: u.role === 'admin' ? 'var(--primary-light)' : 'var(--secondary-light)',
                      color: u.role === 'admin' ? 'var(--primary)' : 'var(--secondary)',
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: '9999px',
                      fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                      backgroundColor: u.is_active ? 'var(--success-light)' : 'var(--danger-light)',
                      color: u.is_active ? 'var(--success)' : 'var(--danger)',
                      display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    }}>
                      <span className={styles.statusDot} style={{ background: u.is_active ? 'var(--success)' : 'var(--danger)' }} />
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                      <button className={custStyles.actionBtn} onClick={() => openEditModal(u)} title="Edit"><Edit2 size={16} /></button>
                      <button
                        className={custStyles.actionBtn}
                        style={{ color: u.is_active ? 'var(--warning)' : 'var(--success)' }}
                        onClick={() => toggleStatus(u)}
                        title={u.is_active ? 'Deactivate' : 'Activate'}
                      >
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
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input-field"
                    required={!editingUser}
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', color: 'var(--text-muted)', padding: '0.25rem' }}
                  >
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
