"use client"
import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import dashStyles from '../dashboard.module.css';
import custStyles from '../customers/customers.module.css';
import { Plus, Edit2, Trash2, Scissors, ChevronDown, ChevronRight, Layers, Clock, Package, Check } from 'lucide-react';
import styles from './services.module.css';

interface SubService {
  id: number; name: string; category: string; sub_category: string | null;
  price: number; duration: number; parent_id: number | null;
  is_length_based: number;
  price_short: number | null; price_medium: number | null;
  price_long: number | null; price_extra_long: number | null;
}
interface Service extends SubService {
  sub_services: SubService[];
}

interface PackageServiceItem {
  id: number; name: string; category: string; sub_category: string | null;
  price: number; duration: number;
}
interface PackageItem {
  id: number; name: string; price: number; duration: number;
  services: PackageServiceItem[];
}

const DEFAULT_CATEGORIES = [
  'Hair', 'Skin', 'Nails', 'Makeup', 'Spa & Massage', 'Hair Removal', 'Bridal', 'Facial',
];

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | SubService | null>(null);
  const [formData, setFormData] = useState({ name: '', category: '', sub_category: '', price: '', duration: '', parent_id: null as number | null, is_length_based: 0, price_short: '', price_medium: '', price_long: '', price_extra_long: '' });
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedServices, setExpandedServices] = useState<Set<number>>(new Set());
  const [emptySubCats, setEmptySubCats] = useState<Record<string, string[]>>({});
  const [showNewSubCat, setShowNewSubCat] = useState(false);
  const [newSubCatInput, setNewSubCatInput] = useState('');

  // ── Package state ──────────────────────────────────────
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [showPkgModal, setShowPkgModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageItem | null>(null);
  const [pkgForm, setPkgForm] = useState({ name: '', price: '', duration: '' });
  const [pkgSelectedServices, setPkgSelectedServices] = useState<Set<number>>(new Set());
  const [expandedPackages, setExpandedPackages] = useState<Set<number>>(new Set());
  const [allFlatServices, setAllFlatServices] = useState<SubService[]>([]);

  const allCategories = [...DEFAULT_CATEGORIES, ...customCategories];

  const fetchServices = async () => {
    const res = await api.get('/services/');
    setServices(res.data);
    const existing = res.data.map((s: Service) => s.category).filter((c: string) => c && !DEFAULT_CATEGORIES.includes(c));
    setCustomCategories(prev => Array.from(new Set([...prev, ...existing])));
  };

  const fetchAllFlat = async () => {
    const res = await api.get('/services/all');
    setAllFlatServices(res.data);
  };

  const fetchPackages = async () => {
    try {
      const res = await api.get('/packages/');
      setPackages(res.data);
    } catch { /* packages endpoint may not exist yet */ }
  };

  useEffect(() => { fetchServices(); fetchAllFlat(); fetchPackages(); }, []);

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
    try { await api.delete(`/services/category/${encodeURIComponent(cat)}`); fetchServices(); fetchAllFlat(); }
    catch { alert('Error deleting category.'); }
  };

  const handleDeleteSubCategory = async (cat: string, sub: string) => {
    if (!window.confirm(`Delete "${sub}" and all its services?`)) return;
    try {
      await api.delete(`/services/category/${encodeURIComponent(cat)}/sub/${encodeURIComponent(sub)}`);
      setEmptySubCats(prev => ({ ...prev, [cat]: (prev[cat] || []).filter(sc => sc !== sub) }));
      fetchServices(); fetchAllFlat();
    } catch { alert('Error deleting sub-category.'); }
  };

  const handleDelete = async (s: Service | SubService) => {
    if (!window.confirm(`Delete "${s.name}"?`)) return;
    try { await api.delete(`/services/${s.id}`); fetchServices(); fetchAllFlat(); }
    catch { alert('Error deleting service.'); }
  };

  // ── Modal helpers ─────────────────────────────────────
  const resetModal = () => { setShowNewCategory(false); setNewCategoryName(''); setShowNewSubCat(false); setNewSubCatInput(''); };

  const openAdd = () => {
    setEditingService(null);
    setFormData({ name: '', category: '', sub_category: '', price: '', duration: '', parent_id: null, is_length_based: 0, price_short: '', price_medium: '', price_long: '', price_extra_long: '' });
    resetModal(); setShowModal(true);
  };

  const openAddToSubCat = (cat: string, subCat: string) => {
    setEditingService(null);
    setFormData({ name: '', category: cat, sub_category: subCat, price: '', duration: '', parent_id: null, is_length_based: 0, price_short: '', price_medium: '', price_long: '', price_extra_long: '' });
    resetModal(); setShowModal(true);
  };

  const openAddSubService = (parent: Service) => {
    setEditingService(null);
    setFormData({ name: '', category: parent.category, sub_category: parent.sub_category || '', price: '', duration: '', parent_id: parent.id, is_length_based: 0, price_short: '', price_medium: '', price_long: '', price_extra_long: '' });
    resetModal(); setShowModal(true);
  };

  const openEdit = (s: Service | SubService) => {
    setEditingService(s);
    setFormData({ name: s.name, category: s.category, sub_category: s.sub_category || '', price: String(s.price), duration: String(s.duration), parent_id: s.parent_id || null, is_length_based: s.is_length_based || 0, price_short: s.price_short != null ? String(s.price_short) : '', price_medium: s.price_medium != null ? String(s.price_medium) : '', price_long: s.price_long != null ? String(s.price_long) : '', price_extra_long: s.price_extra_long != null ? String(s.price_extra_long) : '' });
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
      const payload = {
        name: formData.name, category: formData.category, sub_category: formData.sub_category || null,
        price: formData.is_length_based ? (parseFloat(formData.price_short) || 0) : (parseFloat(formData.price) || 0),
        duration: parseInt(formData.duration) || 0, parent_id: formData.parent_id,
        is_length_based: formData.is_length_based,
        price_short: formData.is_length_based ? (parseFloat(formData.price_short) || null) : null,
        price_medium: formData.is_length_based ? (parseFloat(formData.price_medium) || null) : null,
        price_long: formData.is_length_based ? (parseFloat(formData.price_long) || null) : null,
        price_extra_long: formData.is_length_based ? (parseFloat(formData.price_extra_long) || null) : null,
      };
      if (editingService) await api.put(`/services/${editingService.id}`, payload);
      else await api.post('/services/', payload);
      setShowModal(false); setEditingService(null); resetModal(); fetchServices(); fetchAllFlat();
    } catch { alert(editingService ? 'Error updating service.' : 'Error adding service.'); }
  };

  const isSubService = formData.parent_id !== null;

  // ── Package helpers ────────────────────────────────────
  const openCreatePackage = () => {
    setEditingPkg(null);
    setPkgForm({ name: '', price: '', duration: '' });
    setPkgSelectedServices(new Set());
    setShowPkgModal(true);
  };

  const openEditPackage = (pkg: PackageItem) => {
    setEditingPkg(pkg);
    setPkgForm({ name: pkg.name, price: String(pkg.price), duration: String(pkg.duration) });
    setPkgSelectedServices(new Set(pkg.services.map(s => s.id)));
    setShowPkgModal(true);
  };

  const togglePkgService = (id: number) => {
    setPkgSelectedServices(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // Auto-calculate price & duration from selected services
  const selectedServicesList = allFlatServices.filter(s => pkgSelectedServices.has(s.id));
  const autoPrice = selectedServicesList.reduce((sum, s) => sum + s.price, 0);
  const autoDuration = selectedServicesList.reduce((sum, s) => sum + s.duration, 0);

  const handlePkgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pkgSelectedServices.size === 0) { alert('Please select at least one service.'); return; }
    try {
      const payload = {
        name: pkgForm.name,
        price: parseFloat(pkgForm.price) || 0,
        duration: parseInt(pkgForm.duration) || 0,
        service_ids: Array.from(pkgSelectedServices),
      };
      if (editingPkg) await api.put(`/packages/${editingPkg.id}`, payload);
      else await api.post('/packages/', payload);
      setShowPkgModal(false); setEditingPkg(null); fetchPackages();
    } catch { alert(editingPkg ? 'Error updating package.' : 'Error creating package.'); }
  };

  const handleDeletePackage = async (pkg: PackageItem) => {
    if (!window.confirm(`Delete package "${pkg.name}"?`)) return;
    try { await api.delete(`/packages/${pkg.id}`); fetchPackages(); }
    catch { alert('Error deleting package.'); }
  };

  // Group flat services by category for the package modal selector
  const flatGrouped = allFlatServices.reduce<Record<string, SubService[]>>((acc, s) => {
    const cat = s.category || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

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
        {s.is_length_based ? (
          <span className={styles.servicePrice} style={{ fontSize: '0.8rem' }}>₹{s.price_short} – ₹{s.price_extra_long}</span>
        ) : (
          <span className={styles.servicePrice}>₹{s.price}</span>
        )}
      </div>

      {!!s.is_length_based && (
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--border)' }}>
          {[{ label: 'Short', val: s.price_short }, { label: 'Medium', val: s.price_medium }, { label: 'Long', val: s.price_long }, { label: 'Extra Long', val: s.price_extra_long }].map(item => (
            <span key={item.label} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '999px', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 500 }}>
              {item.label}: ₹{item.val}
            </span>
          ))}
        </div>
      )}

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
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openCreatePackage}>
            <Package size={18} /> Create Package
          </button>
          <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={openAdd}>
            <Plus size={18} /> Add Service
          </button>
        </div>
      </div>

      {/* ═══ Packages Section ═══ */}
      {packages.length > 0 && (
        <div className={styles.categorySection}>
          <div className={styles.categoryHeader}>
            <div className={styles.categoryLeft}>
              <Package size={18} />
              <h2 className={styles.categoryTitle}>Packages</h2>
              <span className={styles.categoryCount}>{packages.length}</span>
            </div>
          </div>
          <div className={styles.grid}>
            {packages.map(pkg => (
              <div key={pkg.id} className={styles.serviceCard} style={{ borderLeft: '3px solid var(--primary)' }}>
                <div className={styles.serviceCardTop}>
                  <div className={styles.serviceInfo}>
                    <div className={styles.serviceIcon} style={{ background: 'var(--primary)', color: 'white' }}><Package size={16} /></div>
                    <div>
                      <h3 className={styles.serviceName}>{pkg.name}</h3>
                      <div className={styles.serviceLabel}>{pkg.services.length} service{pkg.services.length !== 1 ? 's' : ''} included</div>
                    </div>
                  </div>
                  <span className={styles.servicePrice}>₹{pkg.price}</span>
                </div>

                <div className={styles.serviceFooter}>
                  <span className={styles.serviceDuration}><Clock size={13} /> {pkg.duration} mins</span>
                  <div className={styles.serviceActions}>
                    <button className={custStyles.actionBtn} onClick={() => openEditPackage(pkg)} title="Edit"><Edit2 size={15} /></button>
                    <button className={custStyles.actionBtn} onClick={() => handleDeletePackage(pkg)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={15} /></button>
                  </div>
                </div>

                {pkg.services.length > 0 && (
                  <>
                    <button className={styles.subServiceToggle} onClick={() => setExpandedPackages(prev => { const n = new Set(prev); n.has(pkg.id) ? n.delete(pkg.id) : n.add(pkg.id); return n; })}>
                      <ChevronRight size={13} style={{ transform: expandedPackages.has(pkg.id) ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                      {pkg.services.length} service{pkg.services.length !== 1 ? 's' : ''} in package
                    </button>
                    {expandedPackages.has(pkg.id) && pkg.services.map(s => (
                      <div key={s.id} className={styles.subServiceRow}>
                        <div>
                          <span className={styles.subServiceName}>{s.name}</span>
                          <span className={styles.subServiceMeta}>{s.category} · {s.duration} mins</span>
                        </div>
                        <span className={styles.subServicePrice}>₹{s.price}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Services by Category ═══ */}
      {services.length === 0 && packages.length === 0 ? (
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

      {/* ═══ Add/Edit Service Modal ═══ */}
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
                  <input type="number" step="0.01" min="0" className="input-field" required={!formData.is_length_based} placeholder="e.g. 500" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} disabled={!!formData.is_length_based} style={formData.is_length_based ? { opacity: 0.4 } : {}} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" min="0" className="input-field" required placeholder="e.g. 30" value={formData.duration} onChange={e => setFormData({ ...formData, duration: e.target.value })} />
                </div>
              </div>

              {/* Length Based Pricing Option */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}>
                  <input type="checkbox" checked={!!formData.is_length_based} onChange={e => setFormData({ ...formData, is_length_based: e.target.checked ? 1 : 0, price: e.target.checked ? '' : formData.price })} />
                  Length Based Price
                </label>
              </div>

              {!!formData.is_length_based && (
                <div style={{ background: 'var(--bg-color)', borderRadius: '0.5rem', padding: '1rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label className="label">Short Hair (₹)</label>
                      <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 300" value={formData.price_short} onChange={e => setFormData({ ...formData, price_short: e.target.value })} />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label className="label">Medium Hair (₹)</label>
                      <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 500" value={formData.price_medium} onChange={e => setFormData({ ...formData, price_medium: e.target.value })} />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label className="label">Long Hair (₹)</label>
                      <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 700" value={formData.price_long} onChange={e => setFormData({ ...formData, price_long: e.target.value })} />
                    </div>
                    <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                      <label className="label">Extra Long Hair (₹)</label>
                      <input type="number" step="0.01" min="0" className="input-field" required placeholder="e.g. 900" value={formData.price_extra_long} onChange={e => setFormData({ ...formData, price_extra_long: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowModal(false); setEditingService(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingService ? 'Update' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Create/Edit Package Modal ═══ */}
      {showPkgModal && (
        <div className={custStyles.modalOverlay} onClick={() => { setShowPkgModal(false); setEditingPkg(null); }}>
          <div className={custStyles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <h2>{editingPkg ? 'Edit Package' : 'Create Package'}</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Select services to bundle into a package
            </p>
            <form onSubmit={handlePkgSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem', flex: 1, overflow: 'hidden' }}>
              <div>
                <label className="label">Package Name</label>
                <input className="input-field" required placeholder="e.g. Bridal Package" value={pkgForm.name} onChange={e => setPkgForm({ ...pkgForm, name: e.target.value })} />
              </div>

              {/* Service selection */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <label className="label">Select Services ({pkgSelectedServices.size} selected)</label>
                <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border)', borderRadius: '0.5rem', maxHeight: '300px' }}>
                  {Object.keys(flatGrouped).sort().map(cat => (
                    <div key={cat}>
                      <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-color)', fontWeight: 600, fontSize: '0.8rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 1 }}>
                        {cat}
                      </div>
                      {flatGrouped[cat].map(s => {
                        const selected = pkgSelectedServices.has(s.id);
                        return (
                          <div
                            key={s.id}
                            onClick={() => togglePkgService(s.id)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.5rem 0.75rem', cursor: 'pointer',
                              background: selected ? 'var(--primary-light)' : 'transparent',
                              borderBottom: '1px solid var(--border)',
                              transition: 'background 0.15s',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem',
                                border: selected ? 'none' : '2px solid var(--border)',
                                background: selected ? 'var(--primary)' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                flexShrink: 0, transition: 'all 0.15s',
                              }}>
                                {selected && <Check size={14} color="white" />}
                              </div>
                              <div>
                                <div style={{ fontWeight: 500, fontSize: '0.875rem', color: 'var(--text-main)' }}>{s.name}</div>
                                {s.sub_category && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.sub_category}</div>}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)' }}>₹{s.price}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.duration} mins</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  {allFlatServices.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No services available. Add services first.</div>
                  )}
                </div>
              </div>

              {/* Auto-calculated totals */}
              {pkgSelectedServices.size > 0 && (
                <div style={{ background: 'var(--bg-color)', borderRadius: '0.5rem', padding: '0.75rem', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Total of selected services:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>₹{autoPrice} · {autoDuration} mins</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Package Price (₹)</label>
                  <input type="number" step="0.01" min="0" className="input-field" required placeholder={autoPrice ? `e.g. ${autoPrice}` : 'e.g. 2000'} value={pkgForm.price} onChange={e => setPkgForm({ ...pkgForm, price: e.target.value })} />
                </div>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <label className="label">Duration (mins)</label>
                  <input type="number" min="0" className="input-field" required placeholder={autoDuration ? `e.g. ${autoDuration}` : 'e.g. 120'} value={pkgForm.duration} onChange={e => setPkgForm({ ...pkgForm, duration: e.target.value })} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowPkgModal(false); setEditingPkg(null); }} className="btn-primary" style={{ background: 'var(--text-muted)' }}>Cancel</button>
                <button type="submit" className="btn-primary">{editingPkg ? 'Update Package' : 'Create Package'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
