"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, CheckCircle, XCircle, Clock, Edit2, UserPlus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';

interface Service {
  id: number; name: string; price: number; category?: string; duration?: number;
}
interface Customer {
  id: number; name: string; phone: string; email?: string;
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
  completed_at: string | null;
}

const STATUSES = ['booked', 'pending', 'completed', 'cancelled'];
const PAYMENT_STATUSES = ['unpaid', 'paid', 'partial'];

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

export default function AppointmentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  // Add new customer inline
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  const [formData, setFormData] = useState({
    customer_id: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '10:00',
    service_ids: [] as number[],
    assigned_staff_id: '',
    status: 'booked',
    payment_status: 'unpaid',
    paid_amount: '',
  });

  const fetchData = async () => {
    const [appRes, custRes, servRes, staffRes] = await Promise.allSettled([
      api.get('/appointments/'),
      api.get('/customers/'),
      api.get('/services/'),
      api.get('/appointments/staff'),
    ]);
    if (appRes.status === 'fulfilled') setAppointments(appRes.value.data);
    if (custRes.status === 'fulfilled') setCustomers(custRes.value.data);
    if (servRes.status === 'fulfilled') setServices(servRes.value.data);
    if (staffRes.status === 'fulfilled') setStaffMembers(staffRes.value.data);
  };

  useEffect(() => { fetchData(); }, []);

  // Group services by category
  const groupedServices = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const openAddModal = () => {
    setEditingAppt(null);
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    setFormData({
      customer_id: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      time: '10:00',
      service_ids: [],
      assigned_staff_id: '',
      status: 'booked',
      payment_status: 'unpaid',
      paid_amount: '',
    });
    setShowModal(true);
  };

  const openEditModal = (appt: Appointment) => {
    setEditingAppt(appt);
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    setFormData({
      customer_id: String(appt.customer.id),
      date: appt.date,
      time: appt.time,
      service_ids: appt.services.map(s => s.id),
      assigned_staff_id: appt.assigned_staff_id ? String(appt.assigned_staff_id) : '',
      status: appt.status,
      payment_status: appt.payment_status || 'unpaid',
      paid_amount: appt.payment_status === 'partial' ? String(appt.paid_amount || '') : '',
    });
    setShowModal(true);
  };

  const handleServiceToggle = (id: number) => {
    setFormData(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(id)
        ? prev.service_ids.filter(sId => sId !== id)
        : [...prev.service_ids, id]
    }));
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name.trim() || !newCustomer.phone.trim()) return;
    try {
      const res = await api.post('/customers/', newCustomer);
      setCustomers(prev => [...prev, res.data]);
      setFormData(prev => ({ ...prev, customer_id: String(res.data.id) }));
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '' });
    } catch {
      alert('Error adding customer');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        customer_id: parseInt(formData.customer_id),
        date: formData.date,
        time: formData.time,
        service_ids: formData.service_ids,
        assigned_staff_id: formData.assigned_staff_id ? parseInt(formData.assigned_staff_id) : null,
        status: formData.status,
        payment_status: formData.payment_status,
        paid_amount: formData.payment_status === 'partial' ? parseFloat(formData.paid_amount) || 0 : 0,
      };
      if (editingAppt) {
        await api.put(`/appointments/${editingAppt.id}`, payload);
      } else {
        await api.post('/appointments/', payload);
      }
      setShowModal(false);
      setEditingAppt(null);
      fetchData();
    } catch {
      alert(editingAppt ? 'Error updating appointment' : 'Error booking appointment');
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await api.put(`/appointments/${id}/status?status=${status}`);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      fetchData();
    } catch {
      alert('Error deleting appointment.');
    }
  };

  const getStaffName = (appt: Appointment) => {
    if (appt.assigned_staff) return appt.assigned_staff.name;
    return '—';
  };

  return (
    <div>
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Appointments</h1>
          <p className={dashStyles.pageSubtitle}>Manage bookings and schedules</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddModal}>
          <Plus size={18} /> Book Appointment
        </button>
      </div>

      <div className={dashStyles.statCard} style={{ display: 'block' }}>
        <div className={custStyles.tableWrapper}>
          <table className={custStyles.table}>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Services</th>
                <th>Staff</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Total (₹)</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>No appointments scheduled.</td></tr>
              ) : appointments.map(a => (
                <tr key={a.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 500 }}>
                      <Clock size={16} color="var(--text-muted)" />
                      {format(parseISO(a.date), 'MMM d, yyyy')} at {a.time}
                    </div>
                  </td>
                  <td style={{ fontWeight: 500 }}>{a.customer.name}</td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', whiteSpace: 'normal' }}>
                    {a.services.map(s => s.name).join(', ')}
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{getStaffName(a)}</td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: `${getStatusColor(a.status)}20`,
                      color: getStatusColor(a.status),
                      textTransform: 'uppercase'
                    }}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: `${getPaymentColor(a.payment_status || 'unpaid')}20`,
                      color: getPaymentColor(a.payment_status || 'unpaid'),
                      textTransform: 'uppercase'
                    }}>
                      {a.payment_status || 'unpaid'}
                    </span>
                    {a.payment_status === 'partial' && a.paid_amount > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Paid ₹{a.paid_amount} / ₹{a.total_amount}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>₹{a.total_amount}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button onClick={() => openEditModal(a)} className={custStyles.actionBtn} title="Edit"><Edit2 size={16} /></button>
                      {(a.status === 'booked' || a.status === 'pending') && (
                        <>
                          <button onClick={() => updateStatus(a.id, 'completed')} className={custStyles.actionBtn} style={{ color: 'var(--success)' }} title="Mark Completed"><CheckCircle size={18} /></button>
                          <button onClick={() => updateStatus(a.id, 'cancelled')} className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} title="Cancel"><XCircle size={18} /></button>
                        </>
                      )}
                      {isAdmin && (
                        <button onClick={() => handleDelete(a.id)} className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} title="Delete"><Trash2 size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ Booking / Edit Modal ═══ */}
      {showModal && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowModal(false); setEditingAppt(null); }}>
          <div className={custStyles.modal} style={{ maxWidth: '620px' }} onClick={e => e.stopPropagation()}>
            <h2>{editingAppt ? 'Edit Appointment' : 'Book Appointment'}</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>

              {/* Customer */}
              <div>
                <label className="label">Customer</label>
                {!showNewCustomer ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const }}>
                    <select className="input-field" required value={formData.customer_id} onChange={e => setFormData({ ...formData, customer_id: e.target.value })} style={{ flex: 1 }}>
                      <option value="" disabled>-- Choose a customer --</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                    </select>
                    <button type="button" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap', padding: '0.5rem 0.75rem' }} onClick={() => setShowNewCustomer(true)}>
                      <UserPlus size={16} /> New
                    </button>
                  </div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', padding: '0.75rem', borderRadius: '0.375rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const }}>
                      <input className="input-field" placeholder="Customer name" required value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} style={{ flex: 1 }} />
                      <input className="input-field" placeholder="Phone number" required value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} style={{ flex: 1 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => { setShowNewCustomer(false); setNewCustomer({ name: '', phone: '' }); }} className="btn-primary" style={{ background: 'var(--text-muted)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Cancel</button>
                      <button type="button" onClick={handleAddNewCustomer} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Add Customer</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Date & Time */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label className="label">Date</label>
                  <input type="date" className="input-field" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label className="label">Time</label>
                  <input type="time" className="input-field" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                </div>
              </div>

              {/* Services grouped by category */}
              <div>
                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Select Services</label>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.375rem' }}>
                  {Object.entries(groupedServices).sort(([a], [b]) => a.localeCompare(b)).map(([category, catServices]) => (
                    <div key={category}>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-color)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0 }}>
                        {category}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', padding: '0.5rem 0.75rem' }}>
                        {catServices.map(s => (
                          <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem 0' }}>
                            <input type="checkbox" checked={formData.service_ids.includes(s.id)} onChange={() => handleServiceToggle(s.id)} />
                            {s.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>₹{s.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assigned Staff & Status */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label className="label">Assigned Staff</label>
                  <select className="input-field" value={formData.assigned_staff_id} onChange={e => setFormData({ ...formData, assigned_staff_id: e.target.value })}>
                    <option value="">-- No staff assigned --</option>
                    {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                  </select>
                </div>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label className="label">Status</label>
                  <select className="input-field" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payment Status */}
              <div>
                <label className="label">Payment Status</label>
                <select className="input-field" value={formData.payment_status} onChange={e => setFormData({ ...formData, payment_status: e.target.value, paid_amount: e.target.value !== 'partial' ? '' : formData.paid_amount })}>
                  {PAYMENT_STATUSES.map(s => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              </div>

              {/* Paid Amount (shown only for partial) */}
              {formData.payment_status === 'partial' && (
                <div>
                  <label className="label">Paid Amount (₹)</label>
                  <input
                    type="number"
                    className="input-field"
                    placeholder="Enter amount paid"
                    min="0"
                    step="0.01"
                    required
                    value={formData.paid_amount}
                    onChange={e => setFormData({ ...formData, paid_amount: e.target.value })}
                  />
                  {formData.service_ids.length > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      Total: ₹{services.filter(s => formData.service_ids.includes(s.id)).reduce((sum, s) => sum + s.price, 0).toFixed(2)}
                      {formData.paid_amount && (
                        <> &middot; Balance: ₹{(services.filter(s => formData.service_ids.includes(s.id)).reduce((sum, s) => sum + s.price, 0) - parseFloat(formData.paid_amount || '0')).toFixed(2)}</>
                      )}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingAppt(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={formData.service_ids.length === 0}>
                  {editingAppt ? 'Update' : 'Book Now'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
