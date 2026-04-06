"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, Edit2, Trash2, Scissors, ChevronDown, ChevronRight, Layers, Clock } from 'lucide-react';
import styles from './services.module.css';

interface SubService {
  id: number; name: string; category: string; sub_category: string | null;
  price: number; duration: number; parent_id: number | null;
}
interface Service extends SubService {
  sub_services: SubService[];
}

const DEFAULT_CATEGORIES = [
  'Hair', 'Skin', 'Nails', 'Makeup', 'Spa & Massage', 'Hair Removal', 'Bridal', 'Facial',
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | SubService | null>(null);
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '', price: '', duration: '', parent_id: null as number | null });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());
  const [emptySubCats, setEmptySubCats] = useState<Record<string, string[]>>({});
  const [showNewSubCat, setShowNewSubCat] = useState(false);
  const [newSubCatInput, setNewSubCatInput] = useState('');

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const fetchServices = async () => {
    const res = await api.get('/services/');
    setServices(res.data);
    const existing = res.data.map((s: Service) => s.category).filter((c: string) => c && !DEFAULT_CATEGORIES.includes(c));
    setCustomCategories(prev => Array.from(new Set([...prev, ...existing])));
  };
  useEffect(() => { fetchServices(); }, []);

  // ── Grouping ──────────────────────────────────────────
  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const getSubCats = (cat: string, list: Service[]): string[] => {
    const subs = new Set<string>();
    list.forEach(s => { if (s.sub_category) subs.add(s.sub_category); });
    (emptySubCats[cat] || []).forEach(sc => subs.add(sc));
    return Array.from(subs).sort();
  };

  const getExistingSubCats = (cat: string): string[] => {
    const subs = new Set<string>();
    services.filter(s => s.category === cat && s.sub_category).forEach(s => subs.add(s.sub_category!));
    (emptySubCats[cat] || []).forEach(sc => subs.add(sc));
    return Array.from(subs).sort();
  };

  const sortedCategories = Object.keys(grouped).sort();

  // ── Actions ───────────────────────────────────────────
  const toggleExpanded = (id: number) => {
    setExpandedServices(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleDeleteCategory = async (cat: string) => {
    const count = grouped[cat]?.length || 0;
    if (!window.confirm(`Delete "${cat}" and all ${count} service(s)?`)) return;
    try { await api.delete(`/services/category/${encodeURIComponent(cat)}`); fetchServices(); }
    catch { alert('Error deleting category.'); }
  };

  const handleDeleteSubCategory = async (cat: string, sub: string) => {
    if (!window.confirm(`Delete "${sub}" and all its services?`)) return;
    try {
      await api.delete(`/services/category/${encodeURIComponent(cat)}/sub/${encodeURIComponent(sub)}`);
      setEmptySubCats(prev => ({ ...prev, [cat]: (prev[cat] || []).filter(sc => sc !== sub) }));
      fetchServices();
    } catch { alert('Error deleting sub-category.'); }
  };

  const handleDelete = async (s: Service | SubService) => {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    try { await api.delete(`/services/${s.id}`); fetchServices(); }
    catch { alert('Error deleting service.'); }
  };

  // ── Modal helpers ─────────────────────────────────────
  const resetModal = () => { setShowNewCategory(false); setNewCategoryName(''); setShowNewSubCat(false); setNewSubCatInput(''); };

  const openAdd = () => {
    setEditingService(null);
    setFormData({ name: '', category: '', sub_category: '', price: '', duration: '', parent_id: null });
    resetModal(); setShowModal(true);
  };

  const openAddToSubCat = (cat: string, subCat: string) => {
    setEditingService(null);
    setFormData({ name: '', category: cat, sub_category: subCat, price: '', duration: '', parent_id: null });
    resetModal(); setShowModal(true);
  };

  const openAddSubService = (parent: Service) => {
    setEditingService(null);
    setFormData({ name: '', category: parent.category, sub_category: parent.sub_category || '', price: '', duration: '', parent_id: parent.id });
    resetModal(); setShowModal(true);
  };

  const openEdit = (s: Service | SubService) => {
    setEditingService(s);
    setFormData({ name: s.name, category: s.category, sub_category: s.sub_category || '', price: String(s.price), duration: String(s.duration), parent_id: s.parent_id || null });
    resetModal(); setShowModal(true);
  };

  const handleCategoryChange = (v: string) => {
    if (v === '__add_new__') { setShowNewCategory(true); setFormData({ ...formData, category: '' }); }
    else { setShowNewCategory(false); setFormData({ ...formData, category: v }); }
  };

  const handleAddNewCategory = () => {
    const t = newCategoryName.trim();
    if (t && !allCategories.includes(t)) setCustomCategories(prev => [...prev, t]);
    setFormData({ ...formData, category: t }); setShowNewCategory(false); setNewCategoryName('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { name: formData.name, category: formData.category, sub_category: formData.sub_category || null, price: parseFloat(formData.price) || 0, duration: parseInt(formData.duration) || 0, parent_id: formData.parent_id };
      if (editingService) await api.put(`/services/${editingService.id}`, payload);
      else await api.post('/services/', payload);
      setShowModal(false); setEditingService(null); resetModal(); fetchServices();
    } catch { alert(editingService ? 'Error updating service.' : 'Error adding service.'); }
  };

  const isSubService = formData.parent_id !== null;

  // ── Service Card ──────────────────────────────────────
  const ServiceCard = ({ s }: { s: Service }) => (
    <div className={styles.serviceCard}>
      <div className={styles.serviceCardTop}>
        <div className={styles.serviceInfo}>
          <div className={styles.serviceIcon}><Scissors size={16} /></div>
          <div>
            <h3 className={styles.serviceName}>{s.name}</h3>
            <div className={styles.serviceLabel}>
              {s.sub_category ? `${s.category} · ${s.sub_category}` : s.category}
            </div>
          </div>
        </div>
        <span className={styles.servicePrice}>₹{s.price}</span>
      </div>

      <div className={styles.serviceFooter}>
        <span className={styles.serviceDuration}><Clock size={13} /> {s.duration} mins</span>
        <div className={styles.serviceActions}>
          <button className={custStyles.actionBtn} onClick={() => openAddSubService(s)} title="Add sub-service" style={{ color: 'var(--primary)' }}><Layers size={15} /></button>
          <button className={custStyles.actionBtn} onClick={() => openEdit(s)} title="Edit"><Edit2 size={15} /></button>
          <button className={custStyles.actionBtn} onClick={() => handleDelete(s)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
        </div>
      </div>

      {s.sub_services?.length > 0 && (
        <>
          <button className={styles.subServiceToggle} onClick={() => toggleExpanded(s.id)}>
            <ChevronRight size={13} style={{ transform: expandedServices.has(s.id) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            {s.sub_services.length} sub-service{s.sub_services.length > 1 ? 's' : ''}
          </button>
          {expandedServices.has(s.id) && s.sub_services.map(sub => (
            <div key={sub.id} className={styles.subServiceRow}>
              <div>
                <span className={styles.subServiceName}>{sub.name}</span>
                <span className={styles.subServiceMeta}>{sub.duration} mins</span>
              </div>
              <div className={styles.subServiceActions}>
                <span className={styles.subServicePrice}>₹{sub.price}</span>
                <button className={custStyles.actionBtn} onClick={() => openEdit(sub)} title="Edit"><Edit2 size={13} /></button>
                <button className={custStyles.actionBtn} onClick={() => handleDelete(sub)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────
  return (
    <div>
      <div className={custStyles.headerRow}>
        <div>
          <h1 className={dashStyles.pageTitle}>Services</h1>
          <p className={dashStyles.pageSubtitle}>Manage your service offerings</p>
        </div>
        <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAdd}>
          <Plus size={18} /> Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className={styles.emptySubCat} style={{ marginTop: '2rem' }}>No services found. Add one to get started.</div>
      ) : (
        sortedCategories.map(category => {
          const catServices = grouped[category];
          const subCats = getSubCats(category, catServices);
          const noSubCat = catServices.filter(s => !s.sub_category);

          return (
            <div key={category} className={styles.categorySection}>
              {/* Category header */}
              <div className={styles.categoryHeader}>
                <div className={styles.categoryLeft}>
                  <Scissors size={18} />
                  <h2 className={styles.categoryTitle}>{category}</h2>
                  <span className={styles.categoryCount}>{catServices.length}</span>
                </div>
                <button className={custStyles.actionBtn} onClick={() => handleDeleteCategory(category)} title="Delete category" style={{ color: 'var(--danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Services without sub-category */}
              {noSubCat.length > 0 && (
                <div className={styles.grid}>
                  {noSubCat.map(s => <ServiceCard key={s.id} s={s} />)}
                </div>
              )}

              {/* Sub-category groups */}
              {subCats.map(subCat => {
                const subServices = catServices.filter(s => s.sub_category === subCat);
                return (
                  <div key={`${category}__${subCat}`} className={styles.subCategorySection}>
                    <div className={styles.subCategoryHeader}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span className={styles.subCategoryName}>{subCat}</span>
                        <span className={styles.subCategoryBadge}>{subServices.length}</span>
                      </div>
                      <div className={styles.subCategoryActions}>
                        <button className={custStyles.actionBtn} onClick={() => openAddToSubCat(category, subCat)} title={`Add to ${subCat}`} style={{ color: 'var(--primary)' }}><Plus size={15} /></button>
                        <button className={custStyles.actionBtn} onClick={() => handleDeleteSubCategory(category, subCat)} title="Delete sub-category" style={{ color: 'var(--danger)' }}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    {subServices.length > 0 ? (
                      <div className={styles.grid}>
                        {subServices.map(s => <ServiceCard key={s.id} s={s} />)}
                      </div>
                    ) : (
                      <div className={styles.emptySubCat}>No services yet. Click <strong>+</strong> to add.</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })
      )}

      {/* ���══ Modal ═══ */}
      {showModal && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowModal(false); setEditingService(null); }}>
          <div className={custStyles.modal} onClick={e => e.stopPropagation()}>
            <h2>{editingService ? (isSubService ? 'Edit Sub-Service' : 'Edit Service') : (isSubService ? 'Add Sub-Service' : 'Add Service')}</h2>
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
                  <div>
                    <label className="label">Category</label>
                    <div style={{ position: 'relative' }}>
                      <select className="input-field" required value={showNewCategory ? '__add_new__' : formData.category} onChange={e => handleCategoryChange(e.target.value)} style={{ appearance: 'none', paddingRight: '2.5rem', cursor: 'pointer' }}>
                        <option value="" disabled>Select a category</option>
                        {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__add_new__">+ Add New Category</option>
                      </select>
                      <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                    </div>
                    {showNewCategory && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input className="input-field" placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewCategory(); } }} autoFocus />
                        <button type="button" className="btn-primary" style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }} onClick={handleAddNewCategory}>Add</button>
                      </div>
                    )}
                  </div>

                  {formData.category && (
                    <div>
                      <label className="label">Sub-Category <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                      {!showNewSubCat ? (
                        <div style={{ position: 'relative' }}>
                          <select className="input-field" value={formData.sub_category} onChange={e => { if (e.target.value === '__new__') { setShowNewSubCat(true); setNewSubCatInput(''); setFormData({ ...formData, sub_category: '' }); } else { setFormData({ ...formData, sub_category: e.target.value }); } }} style={{ appearance: 'none', paddingRight: '2.5rem', cursor: 'pointer' }}>
                            <option value="">-- None --</option>
                            {getExistingSubCats(formData.category).map(sc => <option key={sc} value={sc}>{sc}</option>)}
                            <option value="__new__">+ New Sub-Category</option>
                          </select>
                          <ChevronDown size={16} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input className="input-field" placeholder="Sub-category name" autoFocus value={newSubCatInput} onChange={e => setNewSubCatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newSubCatInput.trim()) { setFormData({ ...formData, sub_category: newSubCatInput.trim() }); setShowNewSubCat(false); } } }} style={{ flex: 1 }} />
                          <button type="button" className="btn-primary" style={{ padding: '0.5rem 0.75rem' }} onClick={() => { if (newSubCatInput.trim()) { setFormData({ ...formData, sub_category: newSubCatInput.trim() }); setShowNewSubCat(false); } }}>Set</button>
                          <button type="button" className="btn-primary" style={{ padding: '0.5rem 0.75rem', background: 'var(--text-muted)' }} onClick={() => { setShowNewSubCat(false); setNewSubCatInput(''); }}>Cancel</button>
                        </div>
                      )}
                      {formData.sub_category && !showNewSubCat && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '0.25rem', fontWeight: 500 }}>
                          Grouped under: <strong>{formData.category} &gt; {formData.sub_category}</strong>
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Price (₹)</label>
                  <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 500" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" min="0" className="input-field" required placeholder="e.g. 30" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
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
