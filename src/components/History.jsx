import React, { useState, useEffect } from 'react';
import { Search, Calendar, Tag, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Receipt as ReceiptIcon, AlertTriangle } from 'lucide-react';
import { api, formatCurrency } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function History({ onReceiptDeleted }) {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedReceiptId, setExpandedReceiptId] = useState(null);
  
  const { showSuccess, showError } = useToast();

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.receipts.getHistory({
        search: search || undefined,
        category: category || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });
      setReceipts(data);
    } catch (err) {
      showError(err.message || "Failed to load transaction history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search/filters to avoid excessive API requests
    const delayDebounce = setTimeout(() => {
      fetchReceipts();
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [search, category, startDate, endDate]);

  const toggleExpand = (id) => {
    setExpandedReceiptId(prev => prev === id ? null : id);
  };

  const handleDelete = async (id, merchant, total) => {
    if (window.confirm(`Are you sure you want to delete the receipt from ${merchant || 'Unknown Merchant'} for ${formatCurrency(total)}?`)) {
      try {
        await api.receipts.deleteReceipt(id);
        showSuccess("Receipt successfully deleted.");
        // Refresh local list
        setReceipts(prev => prev.filter(r => r.id !== id));
        if (onReceiptDeleted) {
          onReceiptDeleted();
        }
      } catch (err) {
        showError(err.message || "Failed to delete receipt.");
      }
    }
  };

  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Groceries': return 'var(--c-emerald)';
      case 'Dining': return '#3B82F6';
      case 'Snacks': return '#F59E0B';
      case 'Beverages': return '#EC4899';
      case 'Travel': return '#14B8A6';
      case 'Personal Care': return '#A855F7';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="glass-card stat-card" style={{ padding: '30px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <ReceiptIcon size={22} className="accent-text-violet" />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 600, color: 'white' }}>Transaction History</h2>
      </div>

      {/* --- FILTERS PANEL --- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: '16px',
        marginBottom: '24px',
      }} className="filters-grid">
        {/* Search bar */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            className="input-glass"
            placeholder="Search merchant or items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
          <Search size={16} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: '14px', top: '14px' }} />
        </div>

        {/* Category Selector */}
        <div style={{ position: 'relative' }}>
          <select
            className="input-glass"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="" style={{ background: '#0B0F19' }}>All Categories</option>
            {["Groceries", "Dining", "Snacks", "Travel", "Personal Care", "Beverages", "Others"].map(cat => (
              <option key={cat} value={cat} style={{ background: '#0B0F19' }}>{cat}</option>
            ))}
          </select>
          <Tag size={14} color="rgba(255,255,255,0.3)" style={{ position: 'absolute', right: '14px', top: '15px', pointerEvents: 'none' }} />
        </div>

        {/* Start Date */}
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            className="input-glass"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Start Date"
          />
        </div>

        {/* End Date */}
        <div style={{ position: 'relative' }}>
          <input
            type="date"
            className="input-glass"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="End Date"
          />
        </div>
      </div>

      {/* --- TRANSACTIONS LIST --- */}
      {loading && receipts.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '70px', width: '100%' }} />
          ))}
        </div>
      ) : receipts.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '48px 20px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '12px',
          border: '1px dashed var(--border-glass)',
          color: 'var(--text-secondary)'
        }}>
          <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p style={{ fontSize: '0.95rem' }}>No matching transactions found.</p>
          <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '4px' }}>Try resetting or broadening your search queries.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {receipts.map(receipt => {
            const isExpanded = expandedReceiptId === receipt.id;
            const formattedDate = new Date(receipt.date).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });

            return (
              <div 
                key={receipt.id} 
                className="glass-card" 
                style={{ 
                  padding: '16px 20px',
                  background: isExpanded ? 'rgba(255,255,255,0.02)' : 'var(--bg-card)',
                  borderColor: isExpanded ? 'rgba(139,92,246,0.3)' : 'var(--border-glass)'
                }}
              >
                {/* --- COMPACT SUMMARY BAR --- */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-glass)',
                      flexShrink: 0
                    }}>
                      <ReceiptIcon size={18} color="rgba(255,255,255,0.6)" />
                    </div>
                    
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'white' }}>{receipt.store_name}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <Calendar size={12} />
                        {formattedDate}
                        <span style={{ color: 'var(--text-muted)' }}>•</span>
                        <span>{receipt.items?.length || 0} items</span>
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--c-violet)' }}>
                        {formatCurrency(receipt.total_amount)}
                      </span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        OCR Conf: {receipt.ocr_avg_confidence}%
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => toggleExpand(receipt.id)}
                        className="btn-glass"
                        style={{ padding: '8px 12px', borderRadius: '8px' }}
                        title={isExpanded ? "Collapse details" : "Expand details"}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => handleDelete(receipt.id, receipt.store_name, receipt.total_amount)}
                        className="btn-glass"
                        style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--c-rose)', borderColor: 'rgba(239,68,68,0.1)' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--c-rose-glow)';
                          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                          e.currentTarget.style.borderColor = 'rgba(239,68,68,0.1)';
                        }}
                        title="Delete receipt"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* --- EXPANDED DETAILS BLOCK --- */}
                {isExpanded && (
                  <div style={{ 
                    marginTop: '20px', 
                    paddingTop: '20px', 
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px'
                  }}>
                    {/* Itemized pricing table */}
                    <div style={{ flexGrow: 1 }}>
                      <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', letterSpacing: '0.05em' }}>
                        Scanned Items
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {receipt.items && receipt.items.map((item, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              background: 'rgba(0,0,0,0.1)',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.02)'
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#E5E7EB' }}>{item.name}</span>
                              {item.quantity > 1 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                                  Qty: {item.quantity}
                                </span>
                              )}
                              <span style={{ 
                                fontSize: '0.7rem', 
                                marginLeft: '10px', 
                                padding: '2px 8px', 
                                borderRadius: '10px', 
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.05)',
                                color: getCategoryColor(item.category)
                              }}>
                                {item.category}
                              </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>
                                {formatCurrency(item.price * item.quantity)}
                              </span>
                              {item.quantity > 1 && (
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {formatCurrency(item.price)} each
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        {receipt.tax_amount > 0 && (
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '10px 14px', 
                            background: 'rgba(255,255,255,0.01)', 
                            borderTop: '1px dashed rgba(255,255,255,0.06)',
                            marginTop: '8px' 
                          }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Tax / GST Included</span>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--c-emerald)' }}>
                              {formatCurrency(receipt.tax_amount)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Receipt Image display */}
                    {receipt.image_path && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '16px' }}>
                        <h5 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '10px', letterSpacing: '0.05em' }}>
                          Original Receipt Document
                        </h5>
                        <div style={{
                          maxWidth: '280px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          border: '1px solid var(--border-glass)',
                          background: 'rgba(0,0,0,0.2)'
                        }}>
                          <img 
                            src={api.getUploadUrl(receipt.image_path)} 
                            alt="Receipt Document" 
                            style={{ width: '100%', display: 'block', height: 'auto' }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      
      {/* Styles inject */}
      <style>{`
        @media (max-width: 768px) {
          .filters-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
