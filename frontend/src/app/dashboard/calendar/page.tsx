"use client"
import React, { useEffect, useState, useMemo } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import styles from './calendar.module.css';
import {
  Plus, ChevronLeft, ChevronRight, Clock, Edit2, UserPlus,
  CheckCircle, XCircle, CalendarDays,
} from 'lucide-react';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, addWeeks, addMonths, subDays, subWeeks, subMonths,
  isSameMonth, isToday, eachDayOfInterval,
} from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────
interface Service {
  id: number; name: string; category: string; sub_category?: string | null; price: number; duration: number;
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
  payment_mode: string | null;
  completed_at: string | null;
}

type ViewMode = 'daily' | 'weekly' | 'monthly';

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM – 8 PM
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

// ─── Component ───────────────────────────────────────────────────────
export default function CalendarPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);

  const [view, setView] = useState<ViewMode>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());

  // modals
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

  // add new customer inline
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
    payment_mode: '',
    paid_amount: '',
  });

  // ── Fetch ─────────────────────────────────────────────────────────
  const fetchData = async () => {
    const [a, c, s, st] = await Promise.allSettled([
      api.get('/appointments/'),
      api.get('/customers/'),
      api.get('/services/all'),
      api.get('/appointments/staff'),
    ]);
    if (a.status === 'fulfilled') setAppointments(a.value.data);
    if (c.status === 'fulfilled') setCustomers(c.value.data);
    if (s.status === 'fulfilled') setServices(s.value.data);
    if (st.status === 'fulfilled') setStaffMembers(st.value.data);
  };

  useEffect(() => { fetchData(); }, []);

  // ── Group services by category → sub-category ───────────────────
  const groupedServices = services.reduce<Record<string, Record<string, Service[]>>>((acc, s) => {
    const cat = s.category || 'Other';
    const sub = s.sub_category || '';
    if (!acc[cat]) acc[cat] = {};
    if (!acc[cat][sub]) acc[cat][sub] = [];
    acc[cat][sub].push(s);
    return acc;
  }, {});

  // ── Helpers ───────────────────────────────────────────────────────
  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      const key = a.date;
      if (!map[key]) map[key] = [];
      map[key].push(a);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => a.time.localeCompare(b.time)));
    return map;
  }, [appointments]);

  const getApptsForDate = (d: Date) => apptsByDate[format(d, 'yyyy-MM-dd')] || [];

  const getApptsForHour = (d: Date, hour: number) =>
    getApptsForDate(d).filter(a => parseInt(a.time.split(':')[0], 10) === hour);

  const upcomingAppointments = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return appointments
      .filter(a => a.date >= today && (a.status === 'booked' || a.status === 'pending'))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .slice(0, 10);
  }, [appointments]);

  // ── Navigation ────────────────────────────────────────────────────
  const goBack = () => {
    if (view === 'daily') setCurrentDate(d => subDays(d, 1));
    else if (view === 'weekly') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  };
  const goForward = () => {
    if (view === 'daily') setCurrentDate(d => addDays(d, 1));
    else if (view === 'weekly') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };
  const goToday = () => setCurrentDate(new Date());

  const headerLabel = () => {
    if (view === 'daily') return format(currentDate, 'EEEE, MMMM d, yyyy');
    if (view === 'weekly') {
      const s = startOfWeek(currentDate, { weekStartsOn: 1 });
      const e = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'MMMM yyyy');
  };

  // ── Booking form helpers ──────────────────────────────────────────
  const resetForm = () => {
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
  };

  const openBookingForDate = (date: Date, hour?: number) => {
    setEditingAppt(null);
    resetForm();
    setFormData({
      customer_id: '',
      date: format(date, 'yyyy-MM-dd'),
      time: hour !== undefined ? `${String(hour).padStart(2, '0')}:00` : '10:00',
      service_ids: [],
      assigned_staff_id: '',
      status: 'booked',
      payment_status: 'unpaid',
      payment_mode: '',
      paid_amount: '',
    });
    setShowBooking(true);
  };

  const openEditForm = (appt: Appointment) => {
    setDetailAppt(null);
    setEditingAppt(appt);
    resetForm();
    setFormData({
      customer_id: String(appt.customer.id),
      date: appt.date,
      time: appt.time,
      service_ids: appt.services.map(s => s.id).filter((id): id is number => id != null),
      assigned_staff_id: appt.assigned_staff_id ? String(appt.assigned_staff_id) : '',
      status: appt.status,
      payment_status: appt.payment_status || 'unpaid',
      payment_mode: appt.payment_mode || '',
      paid_amount: appt.payment_status === 'partial' ? String(appt.paid_amount || '') : '',
    });
    setShowBooking(true);
  };

  const handleServiceToggle = (id: number) => {
    setFormData(prev => ({
      ...prev,
      service_ids: prev.service_ids.includes(id)
        ? prev.service_ids.filter(x => x !== id)
        : [...prev.service_ids, id],
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
        payment_mode: formData.payment_mode || null,
        paid_amount: formData.payment_status === 'partial' ? parseFloat(formData.paid_amount) || 0 : 0,
      };
      if (editingAppt) {
        await api.put(`/appointments/${editingAppt.id}`, payload);
      } else {
        await api.post('/appointments/', payload);
      }
      setShowBooking(false);
      setEditingAppt(null);
      fetchData();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      alert(editingAppt ? `Error updating appointment: ${detail || err.message}` : `Error booking appointment: ${detail || err.message}`);
    }
  };

  const updateStatus = async (id: number, status: string) => {
    await api.put(`/appointments/${id}/status?status=${status}`);
    setDetailAppt(null);
    fetchData();
  };

  const getCardStyle = (status: string) => {
    switch (status) {
      case 'completed': return styles.appointmentCardCompleted;
      case 'cancelled': return styles.appointmentCardCancelled;
      case 'booked': return styles.appointmentCardBooked;
      default: return styles.appointmentCardScheduled;
    }
  };
  const getEventDotStyle = (status: string) => {
    switch (status) {
      case 'completed': return styles.eventDotCompleted;
      case 'cancelled': return styles.eventDotCancelled;
      case 'booked': return styles.eventDotBooked;
      default: return styles.eventDotScheduled;
    }
  };

  // ── Month / Week days ─────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const mStart = startOfMonth(currentDate);
    const mEnd = endOfMonth(currentDate);
    const calStart = startOfWeek(mStart, { weekStartsOn: 1 });
    const calEnd = endOfWeek(mEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const wStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: wStart, end: addDays(wStart, 6) });
  }, [currentDate]);

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Header */}
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Calendar</h1>
          <p className={dashStyles.pageSubtitle}>View and manage appointments</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => openBookingForDate(new Date())}>
          <Plus size={18} /> Book Appointment
        </button>
      </div>

      {/* Nav row */}
      <div className={styles.navRow}>
        <div className={styles.viewTabs}>
          {(['daily', 'weekly', 'monthly'] as ViewMode[]).map(v => (
            <button key={v} className={view === v ? styles.viewTabActive : styles.viewTab} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.navControls}>
          <button className={styles.navBtn} onClick={goBack}><ChevronLeft size={18} /></button>
          <button className={styles.todayBtn} onClick={goToday}>Today</button>
          <button className={styles.navBtn} onClick={goForward}><ChevronRight size={18} /></button>
          <span className={styles.currentLabel}>{headerLabel()}</span>
        </div>
      </div>

      {/* Content + upcoming sidebar */}
      <div className={styles.contentLayout}>
        <div>
          {/* ─ MONTHLY ─ */}
          {view === 'monthly' && (
            <div className={styles.monthGrid}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className={styles.dayHeader}>{d}</div>
              ))}
              {monthDays.map(day => {
                const dayAppts = getApptsForDate(day);
                const inMonth = isSameMonth(day, currentDate);
                const today = isToday(day);
                return (
                  <div key={day.toISOString()} className={today ? styles.dayCellToday : inMonth ? styles.dayCell : styles.dayCellOther} onClick={() => openBookingForDate(day)}>
                    <div className={today ? styles.dayNumberToday : styles.dayNumber}>{format(day, 'd')}</div>
                    {dayAppts.slice(0, 3).map(a => (
                      <span key={a.id} className={getEventDotStyle(a.status)} onClick={e => { e.stopPropagation(); setDetailAppt(a); }} title={`${a.time} – ${a.customer.name}`}>
                        {a.time.slice(0, 5)} {a.customer.name}
                      </span>
                    ))}
                    {dayAppts.length > 3 && (
                      <span className={styles.moreCount} onClick={e => { e.stopPropagation(); setCurrentDate(day); setView('daily'); }}>
                        +{dayAppts.length - 3} more
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ─ WEEKLY ─ */}
          {view === 'weekly' && (
            <div className={styles.weekGrid}>
              <div className={styles.weekDayHeader} />
              {weekDays.map(day => (
                <div key={day.toISOString()} className={isToday(day) ? styles.weekDayHeaderToday : styles.weekDayHeader}>
                  {format(day, 'EEE')}
                  <span className={isToday(day) ? styles.weekDayNumberToday : styles.weekDayNumber}>{format(day, 'd')}</span>
                </div>
              ))}
              {HOURS.map(hour => (
                <React.Fragment key={hour}>
                  <div className={styles.timeLabel}>
                    {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                  </div>
                  {weekDays.map(day => {
                    const hourAppts = getApptsForHour(day, hour);
                    return (
                      <div key={day.toISOString()} className={styles.weekCell} onClick={() => openBookingForDate(day, hour)}>
                        {hourAppts.map(a => (
                          <div key={a.id} className={getCardStyle(a.status)} onClick={e => { e.stopPropagation(); setDetailAppt(a); }}>
                            {a.customer.name}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          )}

          {/* ─ DAILY ─ */}
          {view === 'daily' && (
            <div className={styles.dayView}>
              {HOURS.map(hour => {
                const hourAppts = getApptsForHour(currentDate, hour);
                return (
                  <div key={hour} className={styles.dayTimeRow} onClick={() => openBookingForDate(currentDate, hour)}>
                    <div className={styles.dayTimeLabel}>
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>
                    <div className={styles.dayTimeSlot}>
                      {hourAppts.map(a => (
                        <div key={a.id} className={getCardStyle(a.status)} onClick={e => { e.stopPropagation(); setDetailAppt(a); }}>
                          <Clock size={14} />
                          <span>{a.time.slice(0, 5)}</span>
                          <span style={{ fontWeight: 600 }}>{a.customer.name}</span>
                          {a.assigned_staff && <span style={{ fontSize: '0.7rem', color: 'inherit', opacity: 0.7 }}>({a.assigned_staff.name})</span>}
                          <span style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>₹{a.total_amount}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Upcoming Sidebar ──────────────────────────────────────── */}
        <div className={styles.upcomingPanel}>
          <div className={styles.upcomingTitle}><CalendarDays size={18} /> Upcoming</div>
          {upcomingAppointments.length === 0 ? (
            <div className={styles.upcomingEmpty}>No upcoming appointments</div>
          ) : (
            upcomingAppointments.map(a => (
              <div key={a.id} className={styles.upcomingItem} onClick={() => setDetailAppt(a)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className={styles.upcomingItemName}>{a.customer.name}</div>
                  <span style={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', color: getStatusColor(a.status) }}>{a.status}</span>
                </div>
                <div className={styles.upcomingItemTime}>
                  {format(parseISO(a.date), 'MMM d, yyyy')} at {a.time.slice(0, 5)}
                </div>
                <div className={styles.upcomingItemServices}>
                  {a.services.map(s => s.name).join(', ')}
                </div>
                {a.assigned_staff && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>Staff: {a.assigned_staff.name}</div>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ Detail Modal ═══════════════════════════════════════════ */}
      {detailAppt && (
        <div className={custStyles.modalOverlay} onClick={() => setDetailAppt(null)}>
          <div className={custStyles.modal} style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Appointment Details</h2>
              <span className={styles.statusBadge} style={{ backgroundColor: `${getStatusColor(detailAppt.status)}20`, color: getStatusColor(detailAppt.status) }}>
                {detailAppt.status}
              </span>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Customer</span>
                <span className={styles.detailValue}>{detailAppt.customer.name}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Phone</span>
                <span className={styles.detailValue}>{detailAppt.customer.phone || '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Date</span>
                <span className={styles.detailValue}>{format(parseISO(detailAppt.date), 'EEEE, MMM d, yyyy')}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Time</span>
                <span className={styles.detailValue}>{detailAppt.time.slice(0, 5)}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Assigned Staff</span>
                <span className={styles.detailValue}>{detailAppt.assigned_staff ? detailAppt.assigned_staff.name : '—'}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Total Amount</span>
                <span className={styles.detailValue} style={{ color: 'var(--primary)', fontWeight: 700 }}>₹{detailAppt.total_amount}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Payment</span>
                <span className={styles.detailValue} style={{ color: getPaymentColor(detailAppt.payment_status || 'unpaid'), fontWeight: 600, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                  {detailAppt.payment_status || 'unpaid'}
                  {detailAppt.payment_status === 'partial' && detailAppt.paid_amount > 0 && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                      (Paid ₹{detailAppt.paid_amount} / ₹{detailAppt.total_amount})
                    </span>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <span className={styles.detailLabel}>Services</span>
              <div className={styles.servicesList}>
                {detailAppt.services.map(s => (
                  <span key={s.id} className={styles.serviceTag}>{s.name} – ₹{s.price}</span>
                ))}
              </div>
            </div>

            <div className={styles.detailActions}>
              {(detailAppt.status === 'booked' || detailAppt.status === 'pending') && (
                <>
                  <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => openEditForm(detailAppt)}>
                    <Edit2 size={15} /> Edit
                  </button>
                  <button className="btn-primary" style={{ background: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => updateStatus(detailAppt.id, 'completed')}>
                    <CheckCircle size={15} /> Complete
                  </button>
                  <button className="btn-primary" style={{ background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.35rem' }} onClick={() => updateStatus(detailAppt.id, 'cancelled')}>
                    <XCircle size={15} /> Cancel
                  </button>
                </>
              )}
              <button className="btn-primary" style={{ background: 'var(--text-muted)' }} onClick={() => setDetailAppt(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Booking / Edit Modal ═══════════════════════════════════ */}
      {showBooking && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowBooking(false); setEditingAppt(null); }}>
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
                      <input className="input-field" placeholder="Customer name" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} style={{ flex: 1 }} />
                      <input className="input-field" placeholder="Phone number" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} style={{ flex: 1 }} />
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

              {/* Services grouped by category → sub-category */}
              <div>
                <label className="label" style={{ marginBottom: '0.5rem', display: 'block' }}>Select Services</label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem' }}>
                  {Object.entries(groupedServices).sort(([a], [b]) => a.localeCompare(b)).map(([category, subGroups]) => (
                    <div key={category}>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--primary-light)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 2 }}>
                        {category}
                      </div>
                      {Object.entries(subGroups).sort(([a], [b]) => a.localeCompare(b)).map(([subCat, subServices]) => (
                        <div key={`${category}__${subCat}`}>
                          {subCat && (
                            <div style={{ padding: '0.35rem 0.75rem 0.35rem 1.25rem', background: 'var(--bg-color)', fontWeight: 600, fontSize: '0.7rem', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              <span style={{ width: '2px', height: '0.75rem', background: 'var(--primary)', borderRadius: '1px' }} />
                              {subCat}
                            </div>
                          )}
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', padding: '0.4rem 0.75rem' }}>
                            {subServices.map(s => (
                              <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', cursor: 'pointer', padding: '0.2rem 0' }}>
                                <input type="checkbox" checked={formData.service_ids.includes(s.id)} onChange={() => handleServiceToggle(s.id)} />
                                {s.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>₹{s.price}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
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

              {/* Payment Status & Mode */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <label className="label">Payment Status</label>
                  <select className="input-field" value={formData.payment_status} onChange={e => setFormData({ ...formData, payment_status: e.target.value, paid_amount: e.target.value !== 'partial' ? '' : formData.paid_amount, payment_mode: e.target.value === 'unpaid' ? '' : formData.payment_mode })}>
                    {PAYMENT_STATUSES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                {formData.payment_status !== 'unpaid' && (
                  <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                    <label className="label">Payment Mode</label>
                    <select className="input-field" value={formData.payment_mode} onChange={e => setFormData({ ...formData, payment_mode: e.target.value })}>
                      <option value="">-- Select mode --</option>
                      <option value="cash">Cash</option>
                      <option value="online">Online</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Paid Amount (shown only for partial) */}
              {formData.payment_status === 'partial' && (() => {
                const totalAmount = services.filter(s => formData.service_ids.includes(s.id)).reduce((sum, s) => sum + s.price, 0);
                const paidAmount = parseFloat(formData.paid_amount) || 0;
                const balance = totalAmount - paidAmount;
                return (
                  <div style={{ background: 'var(--bg-color)', borderRadius: '0.75rem', padding: '1rem 1.25rem', border: '1px solid var(--border)' }}>
                    {formData.service_ids.length > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>Total Amount</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-main)' }}>₹{totalAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div>
                      <label className="label">Amount Paid (₹)</label>
                      <input
                        type="number"
                        className="input-field"
                        placeholder="Enter amount paid"
                        min="0"
                        max={totalAmount || undefined}
                        step="0.01"
                        required
                        value={formData.paid_amount}
                        onChange={e => setFormData({ ...formData, paid_amount: e.target.value })}
                      />
                    </div>
                    {formData.service_ids.length > 0 && paidAmount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          {balance > 0 ? 'Remaining Balance' : 'Fully Paid'}
                        </span>
                        <span style={{ fontSize: '1.125rem', fontWeight: 700, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                          ₹{Math.abs(balance).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowBooking(false); setEditingAppt(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
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
