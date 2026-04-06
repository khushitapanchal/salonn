"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, Edit2, Trash2, Scissors, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import styles from './services.module.css';

interface SubService {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  parent_id: number | null;
}

interface Service {
  id: number;
  name: string;
  category: string;
  price: number;
  duration: number;
  parent_id: number | null;
  sub_services: SubService[];
}

const DEFAULT_CATEGORIES = [
  'Hair',
  'Skin',
  'Nails',
  'Makeup',
  'Spa & Massage',
  'Hair Removal',
  'Bridal',
  'Facial',
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | SubService | null>(null);
  const [formData, setFormData] = useState({ name: '', category: '', price: 0, duration: 30, parent_id: null as number | null });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const fetchServices = async () => {
    const res = await api.get('/services/');
    setServices(res.data);
    const existingCategories = res.data
      .map((s: Service) => s.category)
      .filter((c: string) => c && !DEFAULT_CATEGORIES.includes(c));
    setCustomCategories(prev => {
      const merged = new Set([...prev, ...existingCategories]);
      return Array.from(merged);
    });
  };

  useEffect(() => {
    fetchServices();
  }, []);

  // Group services by category
  const groupedServices = services.reduce<Record<string, Service[]>>((acc, service) => {
    const cat = service.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  const sortedCategories = Object.keys(groupedServices).sort();

  const toggleExpanded = (serviceId: number) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId);
      else next.add(serviceId);
      return next;
    });
  };

  const handleCategoryChange = (value: string) => {
    if (value === '__add_new__') {
      setShowNewCategory(true);
      setFormData({ ...formData, category: '' });
    } else {
      setShowNewCategory(false);
      setFormData({ ...formData, category: value });
    }
  };

  const handleAddNewCategory = () => {
    const trimmed = newCategoryName.trim();
    if (trimmed && !allCategories.includes(trimmed)) {
      setCustomCategories(prev => [...prev, trimmed]);
    }
    setFormData({ ...formData, category: trimmed });
    setShowNewCategory(false);
    setNewCategoryName('');
  };

  const openAddModal = () => {
    setEditingService(null);
    setFormData({ name: '', category: '', price: 0, duration: 30, parent_id: null });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const openAddSubServiceModal = (parent: Service) => {
    setEditingService(null);
    setFormData({ name: '', category: parent.category, price: 0, duration: 30, parent_id: parent.id });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const openEditModal = (service: Service | SubService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      price: service.price,
      duration: service.duration,
      parent_id: service.parent_id || null,
    });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const handleDelete = async (service: Service | SubService) => {
    if (!window.confirm(`Are you sure you want to delete "${service.name}"?`)) return;
    try {
      await api.delete(`/services/${service.id}`);
      fetchServices();
    } catch (err) {
      alert("Error deleting service. Are you admin?");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingService) {
        await api.put(`/services/${editingService.id}`, formData);
      } else {
        await api.post('/services/', formData);
      }
      setShowModal(false);
      setEditingService(null);
      setFormData({ name: '', category: '', price: 0, duration: 30, parent_id: null });
      setShowNewCategory(false);
      setNewCategoryName('');
      fetchServices();
    } catch (err) {
      alert(editingService ? "Error updating service. Are you admin?" : "Error adding service. Are you admin?");
    }
  };

  const isSubService = formData.parent_id !== null;

  return (
    <div>
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Services</h1>
          <p className={dashStyles.pageSubtitle}>Manage your service offerings</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAddModal}>
          <Plus size={18} /> Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <p>No services found. Add one to get started.</p>
      ) : (
        sortedCategories.map(category => (
          <div key={category} style={{ marginBottom: '2rem' }}>
            <div className={styles.categoryHeader}>
              <Scissors size={18} />
              <h2 className={styles.categoryTitle}>{category}</h2>
              <span className={styles.categoryCount}>{groupedServices[category].length}</span>
            </div>
            <div className={styles.grid}>
              {groupedServices[category].map(s => (
                <div key={s.id} className={dashStyles.statCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0, overflow: 'hidden' }}>
                  {/* Main Service */}
                  <div style={{ padding: '1.25rem 1.25rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className={dashStyles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '2.5rem', height: '2.5rem' }}>
                          <Scissors size={18} />
                        </div>
                        <div>
                          <h3 style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</h3>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.category}</span>
                        </div>
                      </div>
                      <h3 style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{s.price}</h3>
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      <span>{s.duration} mins</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className={custStyles.actionBtn} onClick={() => openAddSubServiceModal(s)} title="Add sub-service" style={{ color: 'var(--primary)' }}><Layers size={16} /></button>
                        <button className={custStyles.actionBtn} onClick={() => openEditModal(s)} title="Edit service"><Edit2 size={16} /></button>
                        <button className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s)} title="Delete service"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  </div>

                  {/* Sub-services toggle */}
                  {s.sub_services && s.sub_services.length > 0 && (
                    <>
                      <button
                        onClick={() => toggleExpanded(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.5rem',
                          padding: '0.5rem 1.25rem', background: 'var(--bg-color)',
                          border: 'none', borderTop: '1px solid var(--border)',
                          cursor: 'pointer', fontSize: '0.8rem', color: 'var(--primary)',
                          fontWeight: 600, width: '100%', textAlign: 'left',
                        }}
                      >
                        <ChevronRight size={14} style={{ transform: expandedServices.has(s.id) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                        {s.sub_services.length} sub-service{s.sub_services.length > 1 ? 's' : ''}
                      </button>

                      {expandedServices.has(s.id) && (
                        <div style={{ borderTop: '1px solid var(--border)' }}>
                          {s.sub_services.map(sub => (
                            <div key={sub.id} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              padding: '0.6rem 1.25rem 0.6rem 2.5rem', borderBottom: '1px solid var(--border)',
                              fontSize: '0.85rem',
                            }}>
                              <div>
                                <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{sub.name}</span>
                                <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.75rem' }}>{sub.duration} mins</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>₹{sub.price}</span>
                                <button className={custStyles.actionBtn} onClick={() => openEditModal(sub)} title="Edit"><Edit2 size={14} /></button>
                                <button className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} onClick={() => handleDelete(sub)} title="Delete"><Trash2 size={14} /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {showModal && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowModal(false); setEditingService(null); }}>
          <div className={custStyles.modal} onClick={e => e.stopPropagation()}>
            <h2>
              {editingService
                ? (isSubService ? 'Edit Sub-Service' : 'Edit Service')
                : (isSubService ? 'Add Sub-Service' : 'Add Service')
              }
            </h2>
            {isSubService && !editingService && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Adding under: <strong>{services.find(s => s.id === formData.parent_id)?.name}</strong>
              </p>
            )}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
              <div>
                <label className="label">Service Name</label>
                <input className="input-field" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              {!isSubService && (
                <div>
                  <label className="label">Category</label>
                  <div style={{ position: 'relative' }}>
                    <select
                      className="input-field"
                      required
                      value={showNewCategory ? '__add_new__' : formData.category}
                      onChange={e => handleCategoryChange(e.target.value)}
                      style={{ appearance: 'none', paddingRight: '2.5rem', cursor: 'pointer' }}
                    >
                      <option value="" disabled>Select a category</option>
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__add_new__">+ Add New Category</option>
                    </select>
                    <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                  </div>
                  {showNewCategory && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        className="input-field"
                        placeholder="Enter new category name"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewCategory(); } }}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
                        onClick={handleAddNewCategory}
                      >
                        Add
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Price (₹)</label>
                  <input type="number" step="0.01" className="input-field" required value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value)})} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" className="input-field" required value={formData.duration} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingService(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingService ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
