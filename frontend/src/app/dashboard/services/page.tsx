"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, Edit2, Trash2, Scissors, ChevronDown, ChevronRight, Layers, FolderPlus } from 'lucide-react';
import styles from './services.module.css';

interface SubService {
  id: number;
  name: string;
  category: string;
  sub_category: string | null;
  price: number;
  duration: number;
  parent_id: number | null;
}

interface Service {
  id: number;
  name: string;
  category: string;
  sub_category: string | null;
  price: number;
  duration: number;
  parent_id: number | null;
  sub_services: SubService[];
}

const DEFAULT_CATEGORIES = [
  'Hair', 'Skin', 'Nails', 'Makeup', 'Spa & Massage', 'Hair Removal', 'Bridal', 'Facial',
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | SubService | null>(null);
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '' as string, price: 0, duration: 30, parent_id: null as number | null });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  // Sub-category inline add
  const [addingSubCatFor, setAddingSubCatFor] = useState<string | null>(null);
  const [newSubCatName, setNewSubCatName] = useState('');

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

  useEffect(() => { fetchServices(); }, []);

  // Group: category → sub_category → services
  const groupedByCategory = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const getSubCategories = (categoryServices: Service[]): string[] => {
    const subs = new Set<string>();
    categoryServices.forEach(s => { if (s.sub_category) subs.add(s.sub_category); });
    return Array.from(subs).sort();
  };

  const sortedCategories = Object.keys(groupedByCategory).sort();

  const toggleExpanded = (serviceId: number) => {
    setExpandedServices(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) next.delete(serviceId); else next.add(serviceId);
      return next;
    });
  };


  // Category actions
  const handleDeleteCategory = async (category: string) => {
    const count = groupedByCategory[category]?.length || 0;
    if (!window.confirm(`Delete category "${category}" and all ${count} service(s) in it?`)) return;
    try {
      await api.delete(`/services/category/${encodeURIComponent(category)}`);
      fetchServices();
    } catch { alert('Error deleting category. Are you admin?'); }
  };

  const handleAddSubCategory = (category: string) => {
    setAddingSubCatFor(category);
    setNewSubCatName('');
  };

  const confirmAddSubCategory = (category: string) => {
    const trimmed = newSubCatName.trim();
    if (!trimmed) return;
    setAddingSubCatFor(null);
    setNewSubCatName('');
    // Open add service modal with this sub-category pre-filled
    setEditingService(null);
    setFormData({ name: '', category, sub_category: trimmed, price: 0, duration: 30, parent_id: null });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const handleDeleteSubCategory = async (category: string, subCategory: string) => {
    if (!window.confirm(`Delete sub-category "${subCategory}" and all its services?`)) return;
    try {
      await api.delete(`/services/category/${encodeURIComponent(category)}/sub/${encodeURIComponent(subCategory)}`);
      fetchServices();
    } catch { alert('Error deleting sub-category. Are you admin?'); }
  };

  // Form actions
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
    setFormData({ name: '', category: '', sub_category: '', price: 0, duration: 30, parent_id: null });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const openAddSubServiceModal = (parent: Service) => {
    setEditingService(null);
    setFormData({ name: '', category: parent.category, sub_category: parent.sub_category || '', price: 0, duration: 30, parent_id: parent.id });
    setShowNewCategory(false);
    setShowModal(true);
  };

  const openEditModal = (service: Service | SubService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      sub_category: service.sub_category || '',
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
    } catch { alert("Error deleting service. Are you admin?"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const subCat = formData.sub_category === '__new__' ? '' : formData.sub_category;
      const payload = { ...formData, sub_category: subCat || null };
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
      } else {
        await api.post('/services/', payload);
      }
      setShowModal(false);
      setEditingService(null);
      fetchServices();
    } catch { alert(editingService ? "Error updating service." : "Error adding service."); }
  };

  const isSubService = formData.parent_id !== null;

  // Get existing sub-categories for a given category (for dropdown in modal)
  const getExistingSubCats = (category: string): string[] => {
    const subs = new Set<string>();
    services.filter(s => s.category === category && s.sub_category).forEach(s => subs.add(s.sub_category!));
    return Array.from(subs).sort();
  };

  // Render a service card
  const renderServiceCard = (s: Service) => (
    <div key={s.id} className={dashStyles.statCard} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.25rem 0.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={dashStyles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '2.5rem', height: '2.5rem' }}>
              <Scissors size={18} />
            </div>
            <div>
              <h3 style={{ fontWeight: 600, color: 'var(--text-main)' }}>{s.name}</h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.sub_category ? `${s.category} / ${s.sub_category}` : s.category}
              </span>
            </div>
          </div>
          <h3 style={{ fontWeight: 700, color: 'var(--primary)' }}>₹{s.price}</h3>
        </div>
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          <span>{s.duration} mins</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={custStyles.actionBtn} onClick={() => openAddSubServiceModal(s)} title="Add sub-service" style={{ color: 'var(--primary)' }}><Layers size={16} /></button>
            <button className={custStyles.actionBtn} onClick={() => openEditModal(s)} title="Edit"><Edit2 size={16} /></button>
            <button className={custStyles.actionBtn} style={{ color: 'var(--danger)' }} onClick={() => handleDelete(s)} title="Delete"><Trash2 size={16} /></button>
          </div>
        </div>
      </div>

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
  );

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
        sortedCategories.map(category => {
          const categoryServices = groupedByCategory[category];
          const subCategories = getSubCategories(categoryServices);
          const servicesWithoutSubCat = categoryServices.filter(s => !s.sub_category);

          return (
            <div key={category} style={{ marginBottom: '2rem' }}>
              {/* Category Header */}
              <div className={styles.categoryHeader} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scissors size={18} />
                  <h2 className={styles.categoryTitle}>{category}</h2>
                  <span className={styles.categoryCount}>{categoryServices.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => handleAddSubCategory(category)}
                    title="Add sub-category"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: '1px solid var(--primary)', color: 'var(--primary)', padding: '0.25rem 0.6rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                  >
                    <FolderPlus size={14} /> Sub-Category
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    title="Delete entire category"
                    className={custStyles.actionBtn}
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Inline add sub-category */}
              {addingSubCatFor === category && (
                <div style={{ display: 'flex', gap: '0.5rem', margin: '0.5rem 0 1rem', alignItems: 'center' }}>
                  <input
                    className="input-field"
                    placeholder="Sub-category name (e.g. Hair Cutting)"
                    value={newSubCatName}
                    onChange={e => setNewSubCatName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); confirmAddSubCategory(category); } }}
                    autoFocus
                    style={{ maxWidth: '300px' }}
                  />
                  <button className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} onClick={() => confirmAddSubCategory(category)}>Add & Create Service</button>
                  <button className="btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--text-muted)' }} onClick={() => setAddingSubCatFor(null)}>Cancel</button>
                </div>
              )}

              {/* Services without sub-category */}
              {servicesWithoutSubCat.length > 0 && (
                <div className={styles.grid}>
                  {servicesWithoutSubCat.map(s => renderServiceCard(s))}
                </div>
              )}

              {/* Sub-category groups — always visible as separate sections */}
              {subCategories.map(subCat => {
                const subCatServices = categoryServices.filter(s => s.sub_category === subCat);

                return (
                  <div key={`${category}__${subCat}`} style={{ marginTop: '1rem' }}>
                    {/* Sub-category header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.6rem 1rem', background: 'var(--bg-color)', borderRadius: '0.5rem 0.5rem 0 0',
                      borderBottom: '2px solid var(--primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '3px', height: '1.2rem', background: 'var(--primary)', borderRadius: '2px' }} />
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>{subCat}</span>
                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.15rem 0.6rem', borderRadius: '9999px', fontWeight: 600 }}>
                          {subCatServices.length} service{subCatServices.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingService(null);
                            setFormData({ name: '', category, sub_category: subCat, price: 0, duration: 30, parent_id: null });
                            setShowNewCategory(false);
                            setShowModal(true);
                          }}
                          title={`Add service to ${subCat}`}
                          className={custStyles.actionBtn}
                          style={{ color: 'var(--primary)' }}
                        >
                          <Plus size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteSubCategory(category, subCat)}
                          className={custStyles.actionBtn}
                          style={{ color: 'var(--danger)' }}
                          title="Delete sub-category"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Sub-category services grid */}
                    <div className={styles.grid} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem' }}>
                      {subCatServices.map(s => renderServiceCard(s))}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* ═══ Add/Edit Modal ═══ */}
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
                <input className="input-field" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>

              {!isSubService && (
                <>
                  {/* Category */}
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
                        <button type="button" className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }} onClick={handleAddNewCategory}>Add</button>
                      </div>
                    )}
                  </div>

                  {/* Sub-category (optional) */}
                  {formData.category && (
                    <div>
                      <label className="label">Sub-Category <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                      {getExistingSubCats(formData.category).length > 0 ? (
                        <>
                          <div style={{ position: 'relative' }}>
                            <select
                              className="input-field"
                              value={formData.sub_category === '__new__' ? '__new__' : formData.sub_category}
                              onChange={e => {
                                if (e.target.value === '__new__') {
                                  setFormData({ ...formData, sub_category: '__new__' });
                                } else {
                                  setFormData({ ...formData, sub_category: e.target.value });
                                }
                              }}
                              style={{ appearance: 'none', paddingRight: '2.5rem', cursor: 'pointer' }}
                            >
                              <option value="">-- No sub-category --</option>
                              {getExistingSubCats(formData.category).map(sc => (
                                <option key={sc} value={sc}>{sc}</option>
                              ))}
                              <option value="__new__">+ Add New Sub-Category</option>
                            </select>
                            <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                          </div>
                          {formData.sub_category === '__new__' && (
                            <input
                              className="input-field"
                              placeholder="Enter new sub-category name"
                              autoFocus
                              onChange={e => {
                                const val = e.target.value;
                                if (val) setFormData(prev => ({ ...prev, sub_category: val }));
                              }}
                              style={{ marginTop: '0.5rem' }}
                            />
                          )}
                        </>
                      ) : (
                        <input
                          className="input-field"
                          placeholder="Enter sub-category name (e.g. Hair Cutting)"
                          value={formData.sub_category}
                          onChange={e => setFormData({ ...formData, sub_category: e.target.value })}
                        />
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Price (₹)</label>
                  <input type="number" step="0.01" className="input-field" required value={formData.price} onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" className="input-field" required value={formData.duration} onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) })} />
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
