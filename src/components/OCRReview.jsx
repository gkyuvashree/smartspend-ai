import React, { useState } from 'react';
import { Check, Edit2, AlertTriangle, HelpCircle, Save, X, Calendar, ShoppingBag, Percent, FileText } from 'lucide-react';
import { formatCurrency } from '../services/api';

export default function OCRReview({ receipt, onSave, onCancel }) {
  const [editedReceipt, setEditedReceipt] = useState({ ...receipt });
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [tempItem, setTempItem] = useState({ name: '', price: 0, quantity: 1, category: 'Others' });
  const [activeTab, setActiveTab] = useState('raw'); // 'raw', 'json'

  const handleHeaderChange = (field, value) => {
    setEditedReceipt(prev => {
      const updated = { ...prev };
      if (field === 'total_amount') {
        updated.total_amount = parseFloat(value) || 0;
      } else if (field === 'tax_amount') {
        updated.tax_amount = parseFloat(value) || 0;
      } else {
        updated[field] = value;
      }
      return updated;
    });
  };

  const startEditItem = (index, item) => {
    setEditingItemIndex(index);
    setTempItem({ ...item });
  };

  const cancelEditItem = () => {
    setEditingItemIndex(null);
  };

  const saveEditItem = (index) => {
    const updatedItems = [...editedReceipt.items];
    updatedItems[index] = { ...tempItem };
    
    // Re-calculate subtotal + tax for the total amount
    const newSubtotal = updatedItems.reduce((acc, it) => acc + ((parseFloat(it.price) || 0) * (parseInt(it.quantity) || 1)), 0);
    const totalWithTax = newSubtotal + (parseFloat(editedReceipt.tax_amount) || 0);

    setEditedReceipt(prev => ({
      ...prev,
      items: updatedItems,
      total_amount: parseFloat(totalWithTax.toFixed(2))
    }));
    
    setEditingItemIndex(null);
  };

  const handleItemChange = (field, value) => {
    setTempItem(prev => ({
      ...prev,
      [field]: (field === 'price' || field === 'quantity') ? (parseFloat(value) || 0) : value
    }));
  };

  const submitReceipt = () => {
    onSave(editedReceipt);
  };

  const getConfidenceColor = (score) => {
    if (score >= 90) return 'var(--c-emerald)';
    if (score >= 75) return 'var(--c-amber)';
    return 'var(--c-rose)';
  };

  const getConfidenceBackground = (score) => {
    if (score >= 90) return 'var(--c-emerald-glow)';
    if (score >= 75) return 'var(--c-amber-glow)';
    return 'var(--c-rose-glow)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* --- TOP SUMMARY BAR --- */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white' }}>Audit Scanned Receipt</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Verify extracted details and correct any alignment anomalies.
          </p>
        </div>

        {/* Premium Confidence Gauge Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>OCR Confidence</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: getConfidenceColor(editedReceipt.ocr_avg_confidence) }}>
              {editedReceipt.ocr_avg_confidence}% Accuracy
            </span>
          </div>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: `3px solid ${getConfidenceColor(editedReceipt.ocr_avg_confidence)}`,
            background: getConfidenceBackground(editedReceipt.ocr_avg_confidence),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.9rem',
            color: 'white',
            boxShadow: `0 0 10px ${getConfidenceBackground(editedReceipt.ocr_avg_confidence)}`
          }}>
            {Math.round(editedReceipt.ocr_avg_confidence)}
          </div>
        </div>
      </div>

      {/* --- DUAL COLUMN CONTENT PANEL --- */}
      <div style={{ display: 'grid', gridTemplateColumns: '5fr 7fr', gap: '24px' }} className="review-split-grid">
        
        {/* ================= LEFT COLUMN: RAW TEXT PREVIEW ================= */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={16} className="accent-text-violet" />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>OCR Document Preview</h3>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
              <button 
                onClick={() => setActiveTab('raw')}
                className={`btn-glass ${activeTab === 'raw' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                Raw Text
              </button>
              <button 
                onClick={() => setActiveTab('json')}
                className={`btn-glass ${activeTab === 'json' ? 'btn-primary' : ''}`}
                style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
              >
                Data JSON
              </button>
            </div>
          </div>

          {activeTab === 'raw' ? (
            <div style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#9CA3AF',
              whiteSpace: 'pre-wrap',
              maxHeight: '450px',
              overflowY: 'auto',
              lineHeight: 1.6
            }}>
              {editedReceipt.raw_text || "No raw text available from scanning fallback."}
            </div>
          ) : (
            <pre style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: 'var(--c-emerald)',
              maxHeight: '450px',
              overflowY: 'auto'
            }}>
              {JSON.stringify(editedReceipt, null, 2)}
            </pre>
          )}

          {/* Highlight Summary Widgets */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>Extracted Total</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--c-violet)' }}>
                {formatCurrency(editedReceipt.total_amount)}
              </span>
            </div>
            
            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              padding: '12px'
            }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block' }}>Detected Tax/GST</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--c-emerald)' }}>
                {formatCurrency(editedReceipt.tax_amount)}
              </span>
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: STRUCTURED EDITOR ================= */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Audit Schema Fields</h3>
          </div>

          {/* Header parameters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Store Name
              </label>
              <input
                type="text"
                className="input-glass"
                value={editedReceipt.store_name || ''}
                onChange={(e) => handleHeaderChange('store_name', e.target.value)}
              />
            </div>
            
            <div>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Date
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  className="input-glass"
                  value={editedReceipt.date || ''}
                  onChange={(e) => handleHeaderChange('date', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Tax / GST (₹)
              </label>
              <input
                type="number"
                step="0.01"
                className="input-glass"
                value={editedReceipt.tax_amount || 0}
                onChange={(e) => handleHeaderChange('tax_amount', e.target.value)}
              />
            </div>
          </div>

          {/* Line items checklist */}
          <div>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '12px', letterSpacing: '0.05em' }}>
              Extracted Products & Pricing
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {editedReceipt.items && editedReceipt.items.map((item, idx) => {
                const isEditing = editingItemIndex === idx;
                const isLowConfidence = item.ocr_confidence < 80;

                return (
                  <div 
                    key={idx}
                    className="glass-card"
                    style={{
                      padding: '12px 16px',
                      borderRadius: '10px',
                      background: isEditing ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.1)',
                      border: isEditing 
                        ? '1px solid var(--c-violet)' 
                        : (isLowConfidence ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(255,255,255,0.03)'),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    {isEditing ? (
                      // --- EDITING DRAWER ROW ---
                      <div style={{ display: 'flex', width: '100%', gap: '10px', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="input-glass"
                          value={tempItem.name}
                          onChange={(e) => handleItemChange('name', e.target.value)}
                          style={{ flexGrow: 2, padding: '8px 12px', fontSize: '0.85rem' }}
                        />
                        
                        <select
                          className="input-glass"
                          value={tempItem.category}
                          onChange={(e) => handleItemChange('category', e.target.value)}
                          style={{ flexGrow: 1, padding: '8px 12px', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                          {["Groceries", "Dining", "Snacks", "Travel", "Personal Care", "Beverages", "Others"].map(cat => (
                            <option key={cat} value={cat} style={{ background: '#0B0F19' }}>{cat}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          className="input-glass"
                          placeholder="Qty"
                          value={tempItem.quantity}
                          onChange={(e) => handleItemChange('quantity', e.target.value)}
                          style={{ width: '60px', padding: '8px', fontSize: '0.85rem' }}
                        />

                        <input
                          type="number"
                          step="0.01"
                          className="input-glass"
                          placeholder="Price"
                          value={tempItem.price}
                          onChange={(e) => handleItemChange('price', e.target.value)}
                          style={{ width: '80px', padding: '8px', fontSize: '0.85rem' }}
                        />

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => saveEditItem(idx)} style={{ background: 'var(--c-emerald)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}>
                            <Check size={14} color="white" />
                          </button>
                          <button onClick={cancelEditItem} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', display: 'flex' }}>
                            <X size={14} color="white" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      // --- VIEWING CARD ROW ---
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flexGrow: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 500, fontSize: '0.9rem', color: '#E5E7EB' }}>
                              {item.name}
                            </span>
                            
                            {item.quantity > 1 && (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '1px 6px', borderRadius: '4px' }}>
                                Qty: {item.quantity}
                              </span>
                            )}

                            {isLowConfidence && (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                background: 'var(--c-amber-glow)',
                                color: 'var(--c-amber)',
                                fontSize: '0.65rem',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                fontWeight: 600
                              }}>
                                <AlertTriangle size={8} />
                                OCR: {Math.round(item.ocr_confidence)}%
                              </span>
                            )}
                          </div>
                          
                          <span style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            alignSelf: 'flex-start'
                          }}>
                            {item.category}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--c-violet)' }}>
                              {formatCurrency(item.price * item.quantity)}
                            </span>
                            {item.quantity > 1 && (
                              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {formatCurrency(item.price)} each
                              </span>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => startEditItem(idx, item)}
                            style={{
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              padding: '6px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'flex',
                              color: 'var(--text-secondary)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--c-violet-glow)';
                              e.currentTarget.style.color = 'var(--c-violet)';
                              e.currentTarget.style.borderColor = 'rgba(139,92,246,0.2)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            }}
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Display final calculated total */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            border: '1px solid var(--border-glass)'
          }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Calculated Total (Subtotal + Tax)</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white' }}>
              {formatCurrency(editedReceipt.total_amount)}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button className="btn-glass" onClick={onCancel}>
              Discard
            </button>
            <button className="btn-glass btn-primary" onClick={submitReceipt} style={{ padding: '12px 30px' }}>
              <Check size={16} /> Approve & Save to SQLite
            </button>
          </div>

        </div>

      </div>

      <style>{`
        @media (max-width: 1024px) {
          .review-split-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
