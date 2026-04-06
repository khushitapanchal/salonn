"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import styles from './customers.module.css';
import { Search, Plus, Edit2, Trash2, Eye, Phone, Mail, Calendar, Clock, User, ArrowLeft, FileText, Scissors } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  dob: string | null;
  notes: string | null;
  created_at: string;
}

interface Service {
  id: number; name: string; price: number; category?: string; duration?: number;
}
interface StaffMember {
  id: number; name: string; email: string; role: string;
}
interface Appointment {
  id: number;
  customer: Customer;
  date: string;
  time: string;
  status: string;
  total_amount: number;
  paid_amount: number;
  services: Service[];
  assigned_staff_id: number | null;
  assigned_staff: StaffMember | null;
  payment_status: string;
  payment_mode: string | null;
  completed_at: string | null;
}

const getPaymentColor = (status: string) => {
  switch (status) {
    case 'paid': return 'var(--success)';
    case 'partial': return 'var(--warning)';
    default: return 'var(--danger)';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'var(--success)';
    case 'cancelled': return 'var(--danger)';
    case 'pending': return 'var(--warning)';
    case 'booked': return 'var(--primary)';
    default: return 'var(--warning)';
  }
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', dob: '', notes: '' });

  // Detail view
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerAppointments, setCustomerAppointments] = useState<Appointment[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchCustomers = async () => {
    const res = await api.get(`/customers/?search=${search}`);
    setCustomers(res.data);
  };

  useEffect(() => { fetchCustomers(); }, [search]);

  const closeModal = () => {
    setShowModal(false);
    setEditId(null);
    setFormData({ name: '', phone: '', email: '', dob: '', notes: '' });
  };

  const handleEdit = (customer: Customer) => {
    setEditId(customer.id);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || '',
      dob: customer.dob || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    try {
      await api.delete(`/customers/${id}`);
      if (selectedCustomer?.id === id) setSelectedCustomer(null);
      fetchCustomers();
    } catch {
      alert("Failed to delete customer. Ensure you have admin rights.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...formData };
      if (!payload.email) payload.email = null;
      if (!payload.dob) payload.dob = null;
      if (!payload.notes) payload.notes = null;

      if (editId) {
        await api.put(`/customers/${editId}`, payload);
      } else {
        await api.post('/customers/', payload);
      }

      closeModal();
      fetchCustomers();
      // Refresh detail if editing the selected customer
      if (editId && selectedCustomer?.id === editId) {
        const res = await api.get(`/customers/${editId}`);
        setSelectedCustomer(res.data);
      }
    } catch {
      alert("Error saving customer data.");
    }
  };

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetail(true);
    try {
      const res = await api.get(`/customers/${customer.id}/appointments`);
      setCustomerAppointments(res.data);
    } catch {
      setCustomerAppointments([]);
    }
    setLoadingDetail(false);
  };

  // ── Detail View ───────────────────────────────────────────────────
  if (selectedCustomer) {
    const completedAppts = customerAppointments.filter(a => a.status === 'completed');
    const paidOrPartial = completedAppts.filter(a => a.payment_status === 'paid' || a.payment_status === 'partial');
    const totalVisits = completedAppts.length;
    const totalSpent = paidOrPartial.reduce((sum, a) => sum + (a.paid_amount || 0), 0);
    const lastVisit = completedAppts.length > 0 ? completedAppts[0] : null; // already sorted desc

    return (
      <div>
        {/* Back button + header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <button
            onClick={() => setSelectedCustomer(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1rem', padding: 0 }}
          >
            <ArrowLeft size={18} /> Back to Customers
          </button>
          <div className={styles.headerRow}>
            <div>
              <h1 className={dashStyles.pageTitle}>{selectedCustomer.name}</h1>
              <p className={dashStyles.pageSubtitle}>Customer Profile & Visit History</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => handleEdit(selectedCustomer)}>
                <Edit2 size={16} /> Edit
              </button>
            </div>
          </div>
        </div>

        {/* Info cards row */}
        <div className={dashStyles.statsGrid} style={{ marginBottom: '1.5rem' }}>
          {/* Contact info card */}
          <div className={dashStyles.statCard} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
            <h3 style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Contact Info</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
              <Phone size={16} color="var(--primary)" /> {selectedCustomer.phone}
            </div>
            {selectedCustomer.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <Mail size={16} color="var(--primary)" /> {selectedCustomer.email}
              </div>
            )}
            {selectedCustomer.dob && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                <Calendar size={16} color="var(--primary)" /> DOB: {format(parseISO(selectedCustomer.dob), 'MMM d, yyyy')}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <User size={14} /> Member since {format(parseISO(selectedCustomer.created_at), 'MMM yyyy')}
            </div>
          </div>

          {/* Stats cards */}
          <div className={dashStyles.statCard} style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <div className={dashStyles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '3rem', height: '3rem' }}>
              <Calendar size={20} />
            </div>
            <span className={dashStyles.statValue}>{totalVisits}</span>
            <span className={dashStyles.statLabel}>Total Visits</span>
          </div>

          <div className={dashStyles.statCard} style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <div className={dashStyles.statIcon} style={{ background: 'var(--warning-light)', color: 'var(--warning-dark)', width: '3rem', height: '3rem' }}>
              <Clock size={20} />
            </div>
            <span className={dashStyles.statValue} style={{ fontSize: '1rem' }}>
              {lastVisit ? format(parseISO(lastVisit.date), 'MMM d, yyyy') : '—'}
            </span>
            <span className={dashStyles.statLabel}>Last Visit</span>
          </div>

          <div className={dashStyles.statCard} style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <div className={dashStyles.statIcon} style={{ background: 'var(--success-light)', color: 'var(--success)', width: '3rem', height: '3rem' }}>
              <Scissors size={20} />
            </div>
            <span className={dashStyles.statValue}>₹{totalSpent.toFixed(0)}</span>
            <span className={dashStyles.statLabel}>Total Spent</span>
          </div>
        </div>

        {/* Notes */}
        {selectedCustomer.notes && (
          <div className={dashStyles.statCard} style={{ display: 'block', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <FileText size={16} color="var(--text-muted)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>Notes</span>
            </div>
            <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-main)' }}>{selectedCustomer.notes}</p>
          </div>
        )}

        {/* Visit History */}
        <div className={dashStyles.statCard} style={{ display: 'block' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '1rem' }}>Visit History</h3>
          {loadingDetail ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Loading...</p>
          ) : customerAppointments.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No visit history found.</p>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Visit Date & Time</th>
                    <th>Services Taken</th>
                    <th>Staff</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Bill (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {customerAppointments.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                          <Clock size={15} color="var(--text-muted)" />
                          <div>
                            <div>{format(parseISO(a.date), 'EEE, MMM d, yyyy')}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{a.time.slice(0, 5)}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {a.services.map(s => (
                            <span key={s.id} style={{
                              padding: '0.2rem 0.5rem',
                              background: 'var(--primary-light)',
                              color: 'var(--primary)',
                              borderRadius: '999px',
                              fontSize: '0.7rem',
                              fontWeight: 500,
                            }}>
                              {s.name} – ₹{s.price}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {a.assigned_staff ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                            <User size={14} color="var(--text-muted)" />
                            {a.assigned_staff.name}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '9999px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          backgroundColor: `${getStatusColor(a.status)}20`,
                          color: getStatusColor(a.status),
                          textTransform: 'uppercase',
                        }}>
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span style={{
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            backgroundColor: `${getPaymentColor(a.payment_status || 'unpaid')}20`,
                            color: getPaymentColor(a.payment_status || 'unpaid'),
                            textTransform: 'uppercase',
                          }}>
                            {a.payment_status || 'unpaid'}
                          </span>
                          {a.payment_mode && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.35rem', textTransform: 'capitalize' }}>
                              ({a.payment_mode})
                            </span>
                          )}
                          {a.payment_status === 'partial' && (
                            <div style={{ marginTop: '0.35rem', fontSize: '0.7rem', lineHeight: 1.5 }}>
                              <span style={{ color: 'var(--success)', fontWeight: 600 }}>Paid: ₹{a.paid_amount}</span>
                              <span style={{ color: 'var(--text-muted)' }}> / </span>
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Due: ₹{(a.total_amount - a.paid_amount).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>₹{a.total_amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Edit Modal (reused) */}
        {showModal && (
          <div className={styles.modalOverlay} onClick={closeModal}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <h2>Edit Customer</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                <div>
                  <label className="label">Full Name</label>
                  <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input-field" required value={formData.phone} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, phone: v }); }} pattern="\d{10}" maxLength={10} title="Enter 10 digit phone number" placeholder="10 digit number" />
                </div>
                <div>
                  <label className="label">Notes (Optional)</label>
                  <textarea className="input-field" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Preferences, allergies, or history..." />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={closeModal} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List View ─────────────────────────────────────────────────────
  return (
    <div>
      <div className={styles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Customers</h1>
          <p className={dashStyles.pageSubtitle}>Manage your salon clients</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowModal(true)}>
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className={dashStyles.statCard} style={{ display: 'block' }}>
        <div className={styles.searchBar}>
          <Search size={20} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            className="input-field"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem' }}>No customers found.</td></tr>
              ) : customers.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(c)}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td>{c.phone}</td>
                  <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.notes || '—'}</td>
                  <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button className={styles.actionBtn} onClick={() => openDetail(c)} title="View details"><Eye size={16} /></button>
                    <button className={styles.actionBtn} onClick={() => handleEdit(c)} title="Edit"><Edit2 size={16} /></button>
                    <button className={styles.actionBtn} onClick={() => handleDelete(c.id)} style={{ color: 'var(--danger)' }} title="Delete"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2>{editId ? 'Edit Customer' : 'Add Customer'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label className="label">Full Name</label>
                <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input-field" required value={formData.phone} onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setFormData({ ...formData, phone: v }); }} pattern="\d{10}" maxLength={10} title="Enter 10 digit phone number" placeholder="10 digit number" />
              </div>
              <div>
                <label className="label">Notes (Optional)</label>
                <textarea className="input-field" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Preferences, allergies, or history..." />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
