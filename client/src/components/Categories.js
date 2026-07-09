import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', color: '#3B82F6' });

  useEffect(() => { api.get('/api/categories').then(data => { setCategories(data); setLoading(false); }); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post('/api/categories', form);
    setShowModal(false);
    setForm({ name: '', description: '', color: '#3B82F6' });
    api.get('/api/categories').then(setCategories);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return;
    await api.delete(`/api/categories/${id}`);
    api.get('/api/categories').then(setCategories);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Categories</h1><p>Manage request categories</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Add Category</button>
      </div>
      <div className="grid-cards">
        {categories.map(c => (
          <div key={c.id} className="category-card">
            <div className="category-color" style={{ background: c.color }}></div>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <button className="btn btn-sm btn-outline" onClick={() => handleDelete(c.id)}>Delete</button>
          </div>
        ))}
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Category</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group"><label>Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label>Description</label><input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="form-group"><label>Color</label><input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
              <div className="form-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
