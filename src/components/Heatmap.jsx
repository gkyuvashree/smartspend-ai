import React, { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { formatCurrency } from '../services/api';

export default function Heatmap({ transactions }) {
  // Aggregate daily totals over the past 12 weeks (84 days)
  const heatmapData = useMemo(() => {
    const data = {};
    const now = new Date();
    
    // Group transactions by YYYY-MM-DD
    transactions.forEach(t => {
      data[t.date] = (data[t.date] || 0) + t.total_amount;
    });

    const days = [];
    // Generate dates for the last 12 weeks (12 * 7 = 84 days)
    for (let i = 83; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const amount = data[dateStr] || 0.0;
      
      let level = 0; // Grey
      if (amount > 0 && amount <= 20) level = 1;      // Light emerald
      else if (amount > 20 && amount <= 50) level = 2; // Mid emerald
      else if (amount > 50 && amount <= 150) level = 3;// High emerald
      else if (amount > 150) level = 4;                // Ultra violet!
      
      days.push({
        dateStr,
        amount,
        level,
        weekday: d.getDay(),
        formattedDate: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      });
    }
    
    return days;
  }, [transactions]);

  // Group days into weeks (columns of 7 items each) for rendering a standard contributions layout
  const columns = useMemo(() => {
    const cols = [];
    let currentWeek = [];
    
    heatmapData.forEach((day, idx) => {
      currentWeek.push(day);
      if (currentWeek.length === 7 || idx === heatmapData.length - 1) {
        cols.push(currentWeek);
        currentWeek = [];
      }
    });
    
    return cols;
  }, [heatmapData]);

  return (
    <div className="glass-card stat-card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
        <Calendar size={18} className="accent-text-emerald" />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Daily Spending Heatmap</h3>
      </div>
      
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
        Visualizing your daily spending intensity over the last 12 weeks. Hover cells to see transaction volumes.
      </p>

      {/* --- HEATMAP GRAPH SCROLL CONTAINER --- */}
      <div style={{ overflowX: 'auto', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '6px', minWidth: 'fit-content' }}>
          {/* Weekday Labels Column */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            padding: '2px 8px 2px 0',
            height: '112px'
          }}>
            <span>Mon</span>
            <span>Wed</span>
            <span>Fri</span>
            <span>Sun</span>
          </div>

          {/* Grid Columns */}
          {columns.map((week, wIdx) => (
            <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {week.map((day, dIdx) => (
                <div
                  key={dIdx}
                  className={`heatmap-day lvl-${day.level}`}
                  title={`${day.formattedDate}: ${formatCurrency(day.amount)}`}
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px'
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* --- HEATMAP LEGEND PANEL --- */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span>Less</span>
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.02)' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.15)' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.35)' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(16, 185, 129, 0.60)' }} />
        <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(139, 92, 246, 0.75)' }} />
        <span>More</span>
      </div>
    </div>
  );
}
