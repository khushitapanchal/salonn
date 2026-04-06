"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, Edit2, Trash2, Scissors, ChevronDown, ChevronRight, Layers, FolderPlus, Clock } from 'lucide-react';
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
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '' as string, price: '', duration: '', parent_id: null as number | null });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());

  // Sub-category inline add
  const [addingSubCatFor, setAddingSubCatFor] = useState<string | null>(null);
  const [newSubCatName, setNewSubCatName] = useState('');
  // Track manually created empty sub-categories (before any service is added)
  const [emptySubCats, setEmptySubCats] = useState<Record<string, string[]>>({});
  // "Add new sub-category" mode in the modal
  const [showNewSubCat, setShowNewSubCat] = useState(false);
  const [newSubCatInput, setNewSubCatInput] = useState('');

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

  const getSubCategories = (category: string, categoryServices: Service[]): string[] => {
    const subs = new Set<string>();
    categoryServices.forEach(s => { if (s.sub_category) subs.add(s.sub_category); });
    // Include manually created empty sub-categories
    (emptySubCats[category] || []).forEach(sc => subs.add(sc));
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
    // Create an empty sub-category group (shows immediately, even without services)
    setEmptySubCats(prev => ({
      ...prev,
      [category]: [...(prev[category] || []).filter(sc => sc !== trimmed), trimmed],
    }));
  };

  const handleDeleteSubCategory = async (category: string, subCategory: string) => {
    if (!window.confirm(`Delete sub-category "${subCategory}" and all its services?`)) return;
    try {
      await api.delete(`/services/category/${encodeURIComponent(category)}/sub/${encodeURIComponent(subCategory)}`);
      // Also remove from empty sub-cats state
      setEmptySubCats(prev => ({
        ...prev,
        [category]: (prev[category] || []).filter(sc => sc !== subCategory),
      }));
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
    setFormData({ name: '', category: '', sub_category: '', price: '', duration: '', parent_id: null });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowNewSubCat(false);
    setNewSubCatInput('');
    setShowModal(true);
  };

  const openAddSubServiceModal = (parent: Service) => {
    setEditingService(null);
    setFormData({ name: '', category: parent.category, sub_category: parent.sub_category || '', price: '', duration: '', parent_id: parent.id });
    setShowNewCategory(false);
    setShowModal(true);
  };

  const openEditModal = (service: Service | SubService) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      category: service.category,
      sub_category: service.sub_category || '',
      price: String(service.price),
      duration: String(service.duration),
      parent_id: service.parent_id || null,
    });
    setShowNewCategory(false);
    setNewCategoryName('');
    setShowNewSubCat(false);
    setNewSubCatInput('');
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
      const payload = {
        name: formData.name,
        category: formData.category,
        sub_category: formData.sub_category || null,
        price: parseFloat(formData.price) || 0,
        duration: parseInt(formData.duration) || 0,
        parent_id: formData.parent_id,
      };
      if (editingService) {
        await api.put(`/services/${editingService.id}`, payload);
      } else {
        await api.post('/services/', payload);
      }
      setShowModal(false);
      setEditingService(null);
      setShowNewSubCat(false);
      setNewSubCatInput('');
      fetchServices();
    } catch { alert(editingService ? "Error updating service." : "Error adding service."); }
  };

  const isSubService = formData.parent_id !== null;

  // Get existing sub-categories for a given category (for dropdown in modal)
  const getExistingSubCats = (category: string): string[] => {
    const subs = new Set<string>();
    services.filter(s => s.category === category && s.sub_category).forEach(s => subs.add(s.sub_category!));
    (emptySubCats[category] || []).forEach(sc => subs.add(sc));
    return Array.from(subs).sort();
  };

  // Render a service card
  const renderServiceCard = (s: Service, hideCategory?: boolean) => (
    <div key={s.id} className={dashStyles.statCard} style={{ display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className={dashStyles.statIcon} style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', flexShrink: 0 }}>
              <Scissors size={18} />
            </div>
            <div>
              <h3 style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.3 }}>{s.name}</h3>
              {!hideCategory && (
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.15rem', display: 'block' }}>
                  {s.category}
                </span>
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
            <h3 style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem', margin: 0 }}>₹{s.price}</h3>
          </div>
        </div>

        {/* Duration + Actions row */}
        <div style={{
          marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={14} /> {s.duration} mins
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button className={custStyles.actionBtn} onClick={() => openAddSubServiceModal(s)} title="Add sub-service" style={{ color: 'var(--primary)', padding: '0.35rem' }}><Layers size={15} /></button>
            <button className={custStyles.actionBtn} onClick={() => openEditModal(s)} title="Edit" style={{ padding: '0.35rem' }}><Edit2 size={15} /></button>
            <button className={custStyles.actionBtn} style={{ color: 'var(--danger)', padding: '0.35rem' }} onClick={() => handleDelete(s)} title="Delete"><Trash2 size={15} /></button>
          </div>
        </div>
      </div>

      {/* Sub-services expandable section */}
      {s.sub_services && s.sub_services.length > 0 && (
        <>
          <button
            onClick={() => toggleExpanded(s.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.5rem', background: 'var(--bg-color)',
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
              {s.sub_services.map((sub, idx) => (
                <div key={sub.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.75rem 1.5rem 0.75rem 2.75rem',
                  borderBottom: idx < s.sub_services.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: '0.85rem', background: 'var(--bg-color)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{sub.name}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{sub.duration} mins</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.9rem' }}>₹{sub.price}</span>
                    <button className={custStyles.actionBtn} onClick={() => openEditModal(sub)} title="Edit" style={{ padding: '0.25rem' }}><Edit2 size={13} /></button>
                    <button className={custStyles.actionBtn} style={{ color: 'var(--danger)', padding: '0.25rem' }} onClick={() => handleDelete(sub)} title="Delete"><Trash2 size={13} /></button>
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
          const subCategories = getSubCategories(category, categoryServices);
          const servicesWithoutSubCat = categoryServices.filter(s => !s.sub_category);

          return (
            <div key={category} style={{ marginBottom: '3.5rem' }}>
              {/* Category Header */}
              <div className={styles.categoryHeader} style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Scissors size={18} />
                  <h2 className={styles.categoryTitle}>{category}</h2>
                  <span className={styles.categoryCount}>{categoryServices.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                  <div key={`${category}__${subCat}`} style={{ marginTop: '1.5rem' }}>
                    {/* Sub-category header */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.75rem 1.25rem', background: 'var(--bg-color)', borderRadius: '0.5rem 0.5rem 0 0',
                      borderBottom: '2px solid var(--primary)', borderLeft: '3px solid var(--primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>{subCat}</span>
                        <span style={{ fontSize: '0.7rem', background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.15rem 0.6rem', borderRadius: '9999px', fontWeight: 600 }}>
                          {subCatServices.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            setEditingService(null);
                            setFormData({ name: '', category, sub_category: subCat, price: '', duration: '', parent_id: null });
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
                    <div style={{ padding: '1rem 1.25rem', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 0.5rem 0.5rem', background: 'var(--card-bg)' }}>
                      {subCatServices.length > 0 ? (
                        <div className={styles.grid} style={{ marginTop: 0 }}>
                          {subCatServices.map(s => renderServiceCard(s, true))}
                        </div>
                      ) : (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem 0', margin: 0 }}>
                          No services yet. Click <strong>+</strong> to add a service.
                        </p>
                      )}
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
                      {!showNewSubCat ? (
                        <>
                          <div style={{ position: 'relative' }}>
                            <select
                              className="input-field"
                              value={formData.sub_category}
                              onChange={e => {
                                if (e.target.value === '__new__') {
                                  setShowNewSubCat(true);
                                  setNewSubCatInput('');
                                  setFormData({ ...formData, sub_category: '' });
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
                        </>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input
                            className="input-field"
                            placeholder="Enter new sub-category name"
                            autoFocus
                            value={newSubCatInput}
                            onChange={e => setNewSubCatInput(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                if (newSubCatInput.trim()) {
                                  setFormData({ ...formData, sub_category: newSubCatInput.trim() });
                                  setShowNewSubCat(false);
                                }
                              }
                            }}
                            style={{ flex: 1 }}
                          />
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                            onClick={() => {
                              if (newSubCatInput.trim()) {
                                setFormData({ ...formData, sub_category: newSubCatInput.trim() });
                                setShowNewSubCat(false);
                              }
                            }}
                          >
                            Set
                          </button>
                          <button
                            type="button"
                            className="btn-primary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem', background: 'var(--text-muted)' }}
                            onClick={() => { setShowNewSubCat(false); setNewSubCatInput(''); }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      {formData.sub_category && !showNewSubCat && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', fontWeight: 500 }}>
                          This service will be grouped under: <strong>{formData.category} &gt; {formData.sub_category}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' as const }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Price (₹)</label>
                  <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 500" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" min="0" className="input-field" required placeholder="e.g. 30" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
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
