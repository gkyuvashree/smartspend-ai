import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Upload, 
  History as HistoryIcon, 
  MessageSquare, 
  LogOut, 
  TrendingUp, 
  Sparkles, 
  AlertTriangle, 
  ShieldCheck, 
  FileText, 
  ArrowRight, 
  TrendingDown, 
  HelpCircle,
  FileSpreadsheet,
  CheckCircle,
  Clock,
  Menu,
  X
} from 'lucide-react';
import { api, formatCurrency } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import UploadPanel from './components/UploadPanel';
import OCRReview from './components/OCRReview';
import History from './components/History';
import AIChat from './components/AIChat';
import Heatmap from './components/Heatmap';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

function SmartSpendApp() {
  const { user, logout, isAuthenticated, login, register } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();
  
  // Navigation & Page state
  const [currentPage, setCurrentPage] = useState('landing'); // 'landing', 'login', 'register', 'dashboard'
  const [dashboardTab, setDashboardTab] = useState('overview'); // 'overview', 'upload', 'history', 'chat'
  
  // Auth Form State
  const [authUsername, setAuthUsername] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // Dashboard Data State
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Active OCR Upload state
  const [activeUploadReceipt, setActiveUploadReceipt] = useState(null);
  
  // Mobile navigation drawer toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Sync route based on Auth state
  useEffect(() => {
    if (isAuthenticated) {
      setCurrentPage('dashboard');
      fetchDashboardData();
    } else {
      if (currentPage === 'dashboard') {
        setCurrentPage('landing');
      }
    }
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    setStatsLoading(true);
    try {
      const data = await api.dashboard.getSummary();
      setStats(data);
    } catch (err) {
      showError("Failed to fetch dashboard stats.");
    } finally {
      setStatsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    try {
      await login('demo_user', 'password123');
      showSuccess("Welcome back, Demo User!");
    } catch (err) {
      showError(err.message || "Demo login failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (currentPage === 'login') {
        await login(authUsername, authPassword);
        showSuccess(`Welcome back, ${authUsername}!`);
      } else {
        await register(authUsername, authEmail, authPassword);
        showSuccess(`Account created successfully! Welcome ${authUsername}!`);
      }
    } catch (err) {
      showError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      showInfo("Generating financial report PDF...");
      const blob = await api.reports.downloadPDF();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `SmartSpend_Report_${user?.username || 'user'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showSuccess("PDF report downloaded successfully!");
    } catch (err) {
      showError(err.message || "Failed to download PDF report.");
    }
  };

  // OCR Upload Handlers
  const handleUploadSuccess = (receiptData) => {
    setActiveUploadReceipt(receiptData);
  };

  const handleOCRReviewSave = async (updatedReceipt) => {
    try {
      showInfo("Updating receipt database records...");
      const payload = {
        store_name: updatedReceipt.store_name,
        date: updatedReceipt.date,
        total_amount: updatedReceipt.total_amount,
        items: updatedReceipt.items.map(it => ({
          name: it.name,
          price: it.price,
          category: it.category,
          ocr_confidence: it.ocr_confidence
        }))
      };
      
      await api.receipts.updateReceipt(updatedReceipt.id, payload);
      showSuccess("Receipt details approved & saved successfully!");
      setActiveUploadReceipt(null);
      fetchDashboardData();
      setDashboardTab('overview');
    } catch (err) {
      showError(err.message || "Failed to save updated receipt details.");
    }
  };

  const COLORS = ['#8B5CF6', '#10B981', '#3B82F6', '#F59E0B', '#EC4899', '#14B8A6', '#A855F7', '#6B7280'];

  // --- LANDING PAGE RENDERING ---
  if (currentPage === 'landing') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Glow gradients background */}
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />

        {/* Navigation Bar */}
        <header style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '24px 8%',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(6,9,15,0.7)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 100
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={24} className="accent-text-violet" style={{ animation: 'spin-scanner-icon 8s linear infinite' }} />
            <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.4rem', color: 'white', letterSpacing: '-0.03em' }}>
              SmartSpend<span className="accent-text-violet">.AI</span>
            </span>
          </div>

          <button 
            className="btn-glass" 
            onClick={() => setCurrentPage('login')}
            style={{ padding: '8px 20px', fontSize: '0.9rem', borderRadius: '10px' }}
          >
            Sign In
          </button>
        </header>

        {/* Hero Banner Section */}
        <section style={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 20px',
          maxWidth: '900px',
          margin: '0 auto'
        }}>
          <div style={{
            background: 'var(--c-violet-glow)',
            border: '1px solid rgba(139,92,246,0.3)',
            padding: '6px 16px',
            borderRadius: '30px',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--c-violet)',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 0 15px rgba(139,92,246,0.1)'
          }}>
            <Sparkles size={12} />
            <span>Next-Gen OCR Spending Intelligence</span>
          </div>

          <h1 style={{ 
            fontSize: '3.6rem', 
            fontWeight: 800, 
            lineHeight: 1.15, 
            marginBottom: '24px',
            background: 'linear-gradient(to right, #ffffff 40%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em'
          }}>
            Smart Financial Auditing Powered by OCR & AI
          </h1>

          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '1.15rem',
            lineHeight: 1.6,
            maxWidth: '650px',
            marginBottom: '40px'
          }}>
            Upload receipt documents, extract itemized pricing using Tesseract OCR, categorize spending automatically, and consult a local NLP chatbot.
          </p>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button 
              className="btn-glass btn-primary" 
              onClick={() => setCurrentPage('register')}
              style={{ padding: '14px 32px', fontSize: '1rem', borderRadius: '12px' }}
            >
              Get Started Free <ArrowRight size={16} />
            </button>
            <button 
              className="btn-glass" 
              onClick={handleDemoLogin}
              style={{ padding: '14px 28px', fontSize: '0.95rem', borderRadius: '12px' }}
            >
              Try Demo Environment
            </button>
          </div>
        </section>

        {/* Feature Grid */}
        <section style={{ padding: '60px 8%', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '30px' }} className="landing-features">
            <div className="glass-card">
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--c-violet-glow)', display: 'flex', alignItems: 'center', justifySelf: 'start', justifyContent: 'center', marginBottom: '16px', color: 'var(--c-violet)' }}>
                <Upload size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'white' }}>Tesseract OCR & OpenCV</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Advanced binarization and bilateral noise reduction filters optimize text parsing for itemized products and prices.
              </p>
            </div>

            <div className="glass-card">
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--c-emerald-glow)', display: 'flex', alignItems: 'center', justifySelf: 'start', justifyContent: 'center', marginBottom: '16px', color: 'var(--c-emerald)' }}>
                <TrendingUp size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'white' }}>Smart Categorization</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                NLP models classify item types (Dining, Snacks, Groceries, Beverages, Travel) to compile clear spending breakdowns.
              </p>
            </div>

            <div className="glass-card">
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifySelf: 'start', justifyContent: 'center', marginBottom: '16px', color: '#F59E0B' }}>
                <MessageSquare size={20} />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'white' }}>Offline NLP Assistant</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                Ask financial queries, check budgets, find subscription leaks, and receive savings tips locally.
              </p>
            </div>
          </div>
        </section>

        <style>{`
          @media (max-width: 768px) {
            .landing-features {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // --- LOGIN & REGISTER FORMS RENDERING ---
  if (currentPage === 'login' || currentPage === 'register') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="ambient-glow-1" />
        <div className="ambient-glow-2" />

        <div className="glass-card" style={{ width: '100%', maxWidth: '420px', padding: '40px 30px' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sparkles size={28} className="accent-text-violet" style={{ animation: 'spin-scanner-icon 8s linear infinite' }} />
              <span style={{ fontFamily: 'var(--font-title)', fontWeight: 800, fontSize: '1.5rem', color: 'white' }}>SmartSpend</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', color: 'white' }}>
              {currentPage === 'login' ? 'Welcome back' : 'Create an account'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px' }}>
              {currentPage === 'login' ? 'Sign in to access your dashboard' : 'Scan receipts and analyze budgeting trends'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Username
              </label>
              <input
                type="text"
                className="input-glass"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="e.g. janesmith"
              />
            </div>

            {currentPage === 'register' && (
              <div>
                <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  className="input-glass"
                  required
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                Password
              </label>
              <input
                type="password"
                className="input-glass"
                required
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              className="btn-glass btn-primary" 
              disabled={authLoading}
              style={{ width: '100%', padding: '14px', justifyContent: 'center', marginTop: '10px' }}
            >
              {authLoading ? 'Signing in...' : (currentPage === 'login' ? 'Sign In' : 'Register Account')}
            </button>
          </form>

          {/* Quick Demo access buttons */}
          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              className="btn-glass" 
              onClick={handleDemoLogin}
              disabled={authLoading}
              style={{ width: '100%', justifyContent: 'center', borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.03)' }}
            >
              Sign In with Demo Account
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>
              {currentPage === 'login' ? "Don't have an account? " : "Already have an account? "}
            </span>
            <button 
              onClick={() => {
                setCurrentPage(currentPage === 'login' ? 'register' : 'login');
                setAuthUsername('');
                setAuthEmail('');
                setAuthPassword('');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--c-violet)', fontWeight: 600, cursor: 'pointer' }}
            >
              {currentPage === 'login' ? 'Register here' : 'Sign in here'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD CONTAINER RENDERING ---
  return (
    <div className="dashboard-layout">
      {/* Side Ambient Glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* --- SIDEBAR NAVIGATION --- */}
      <aside className="sidebar">
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div className="sidebar-logo">
            <Sparkles size={20} className="accent-text-violet" style={{ animation: 'spin-scanner-icon 8s linear infinite' }} />
            <span>SmartSpend<span className="accent-text-violet">.AI</span></span>
          </div>

          <nav className="sidebar-nav">
            <button 
              onClick={() => { setDashboardTab('overview'); setMobileMenuOpen(false); }} 
              className={`sidebar-link ${dashboardTab === 'overview' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <LayoutDashboard size={18} />
              Overview
            </button>
            <button 
              onClick={() => { setDashboardTab('upload'); setMobileMenuOpen(false); }} 
              className={`sidebar-link ${dashboardTab === 'upload' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <Upload size={18} />
              Upload Receipt
            </button>
            <button 
              onClick={() => { setDashboardTab('history'); setMobileMenuOpen(false); }} 
              className={`sidebar-link ${dashboardTab === 'history' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <HistoryIcon size={18} />
              History
            </button>
            <button 
              onClick={() => { setDashboardTab('chat'); setMobileMenuOpen(false); }} 
              className={`sidebar-link ${dashboardTab === 'chat' ? 'active' : ''}`}
              style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer' }}
            >
              <MessageSquare size={18} />
              AI Assistant
            </button>
          </nav>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px', marginTop: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '0 8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'var(--c-violet-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--c-violet)',
                fontSize: '0.85rem',
                fontWeight: 700
              }}>
                {user?.username?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user?.username}
                </p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {user?.email}
                </p>
              </div>
            </div>
            
            <button 
              onClick={logout} 
              className="sidebar-link"
              style={{ border: 'none', background: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', color: 'var(--c-rose)' }}
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* --- MOBILE NAVIGATION DRAWER --- */}
      <header style={{
        display: 'none',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-glass)',
        background: 'rgba(6,9,15,0.9)',
        position: 'sticky',
        top: 0,
        zIndex: 99
      }} className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} className="accent-text-violet" />
          <span style={{ fontWeight: 800, color: 'white', fontSize: '1.1rem' }}>SmartSpend</span>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {mobileMenuOpen && (
        <div style={{
          position: 'fixed',
          top: '57px',
          left: 0,
          right: 0,
          background: 'rgba(6,9,15,0.98)',
          borderBottom: '1px solid var(--border-glass)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 98
        }} className="mobile-menu">
          <button 
            onClick={() => { setDashboardTab('overview'); setMobileMenuOpen(false); }} 
            className={`btn-glass ${dashboardTab === 'overview' ? 'btn-primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <LayoutDashboard size={16} /> Overview
          </button>
          <button 
            onClick={() => { setDashboardTab('upload'); setMobileMenuOpen(false); }} 
            className={`btn-glass ${dashboardTab === 'upload' ? 'btn-primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <Upload size={16} /> Upload Receipt
          </button>
          <button 
            onClick={() => { setDashboardTab('history'); setMobileMenuOpen(false); }} 
            className={`btn-glass ${dashboardTab === 'history' ? 'btn-primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <HistoryIcon size={16} /> History
          </button>
          <button 
            onClick={() => { setDashboardTab('chat'); setMobileMenuOpen(false); }} 
            className={`btn-glass ${dashboardTab === 'chat' ? 'btn-primary' : ''}`}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            <MessageSquare size={16} /> AI Assistant
          </button>
          <button 
            onClick={logout} 
            className="btn-glass"
            style={{ width: '100%', justifyContent: 'flex-start', color: 'var(--c-rose)' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      )}

      {/* --- MAIN PAGE CONTENT --- */}
      <main className="main-content">
        {/* Page Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white' }}>
              {dashboardTab === 'overview' && 'Financial Intelligence Summary'}
              {dashboardTab === 'upload' && 'Scan Receipt Document'}
              {dashboardTab === 'history' && 'Audit Transactions Trail'}
              {dashboardTab === 'chat' && 'Spend Analysis Assistant'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
              {dashboardTab === 'overview' && `Welcome back, ${user?.username}. Here is your local financial health score.`}
              {dashboardTab === 'upload' && 'Binarize receipt documents and run OpenCV character parser.'}
              {dashboardTab === 'history' && 'Search and audit verified line items stored in SQLite database.'}
              {dashboardTab === 'chat' && 'Ask local NLP chatbot regarding savings categories or budget leaks.'}
            </p>
          </div>

          {dashboardTab === 'overview' && stats && (
            <button className="btn-glass btn-primary" onClick={handleExportPDF}>
              <FileText size={16} />
              Export Spending PDF
            </button>
          )}
        </div>

        {/* --- PAGE RENDERING SWITCH --- */}
        {dashboardTab === 'overview' && (
          statsLoading ? (
            // Shimmer effect loading state
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '110px' }} />)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '24px' }}>
                <div className="skeleton" style={{ height: '350px' }} />
                <div className="skeleton" style={{ height: '350px' }} />
              </div>
            </div>
          ) : (
            // Core Dashboard Overview
            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              
              {/* --- METRICS SUMMARY CARDS --- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }} className="stats-row">
                {/* Card 1: Total Spend */}
                <div className="glass-card glass-card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Total Outflow</span>
                    <TrendingUp size={16} className="accent-text-violet" />
                  </div>
                  <div className="stat-value">{formatCurrency(stats.total_spend)}</div>
                  <div className="stat-trend accent-text-emerald">
                    <TrendingDown size={12} />
                    <span>Seeded Mock History</span>
                  </div>
                </div>

                {/* Card 2: Receipts Scanned */}
                <div className="glass-card glass-card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Receipts Filed</span>
                    <Clock size={16} className="accent-text-emerald" />
                  </div>
                  <div className="stat-value">{stats.receipt_count}</div>
                  <div className="stat-trend accent-text-emerald">
                    <CheckCircle size={12} />
                    <span>OpenCV Character Verified</span>
                  </div>
                </div>

                {/* Card 3: Financial Health Score */}
                <div className={`glass-card glass-card-hover ${stats.health_score >= 80 ? 'glass-card-emerald' : 'glass-card-rose'}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Health Score</span>
                    <ShieldCheck size={16} color={stats.health_score >= 80 ? 'var(--c-emerald)' : 'var(--c-rose)'} />
                  </div>
                  <div className="stat-value" style={{ color: stats.health_score >= 80 ? 'var(--c-emerald)' : 'var(--c-rose)' }}>
                    {stats.health_score}/100
                  </div>
                  <div className="stat-trend" style={{ color: stats.health_score >= 80 ? 'var(--c-emerald)' : 'var(--c-rose)' }}>
                    <span>{stats.health_score >= 85 ? 'Excellent' : (stats.health_score >= 70 ? 'Fair' : 'Overdraft Warning')}</span>
                  </div>
                </div>

                {/* Card 4: Predictions */}
                <div className="glass-card glass-card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Linear Regression Proj.</span>
                    <Sparkles size={16} className="accent-text-amber" />
                  </div>
                  <div className="stat-value" style={{ fontSize: '1.5rem', marginTop: '18px', marginBottom: '8px' }}>
                    {formatCurrency(stats.predictions.next_7_days)}
                  </div>
                  <div className="stat-trend color-text-muted" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>30-Day Outlook: <strong>{formatCurrency(stats.predictions.next_30_days)}</strong></span>
                  </div>
                </div>
              </div>

              {/* --- MIDDLE ROW: PIE CHART & LEGEND + AI INSIGHTS --- */}
              <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '24px' }} className="middle-row">
                
                {/* Recharts spending breakdown */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '18px' }}>Spending by Category</h3>
                  
                  {stats.category_breakdown.length === 0 ? (
                    <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                      No categorized receipt files found.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexGrow: 1 }} className="pie-layout">
                      <div style={{ width: '180px', height: '180px', flexShrink: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.category_breakdown}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={4}
                              dataKey="amount"
                            >
                              {stats.category_breakdown.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip 
                              contentStyle={{ background: 'rgba(15,23,42,0.95)', border: '1px solid var(--border-glass)', borderRadius: '8px' }} 
                              itemStyle={{ color: 'white' }}
                              formatter={(value) => formatCurrency(value)}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Custom styled breakdown legend table */}
                      <div style={{ flexGrow: 1 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                              <th style={{ textAlign: 'left', paddingBottom: '6px', fontWeight: 600 }}>Category</th>
                              <th style={{ textAlign: 'right', paddingBottom: '6px', fontWeight: 600 }}>Total (₹)</th>
                              <th style={{ textAlign: 'right', paddingBottom: '6px', fontWeight: 600 }}>Share</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stats.category_breakdown.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                <td style={{ padding: '8px 0', display: 'flex', alignItems: 'center', gap: '8px', color: '#E5E7EB' }}>
                                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLORS[idx % COLORS.length] }} />
                                  {row.category}
                                </td>
                                <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, color: 'white' }}>
                                  {formatCurrency(row.amount)}
                                </td>
                                <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-secondary)' }}>
                                  {row.percentage}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* AI generated spending insights */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                    <Sparkles size={18} className="accent-text-violet" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>AI Generated Spending Insights</h3>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1 }}>
                    {stats.insights && stats.insights.map((insight, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '12px 16px', 
                          background: 'rgba(255, 255, 255, 0.02)', 
                          borderRadius: '10px',
                          border: '1px solid rgba(255, 255, 255, 0.04)',
                          fontSize: '0.85rem',
                          color: '#E5E7EB',
                          lineHeight: 1.45
                        }}
                      >
                        {insight}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* --- HEATMAP SECTION --- */}
              <Heatmap transactions={stats.recent_transactions || []} />

              {/* --- ANOMALIES & SUBSCRIPTIONS --- */}
              <div className="glass-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                  <AlertTriangle size={18} className="accent-text-rose" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Detected Anomalies & Subscriptions</h3>
                </div>

                {stats.anomalies && stats.anomalies.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No anomalous expenditure or subscription leaks found.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }} className="anomalies-grid">
                    {stats.anomalies.map((anom, idx) => (
                      <div 
                        key={idx} 
                        className="glass-card" 
                        style={{ 
                          padding: '14px 18px', 
                          background: 'rgba(0,0,0,0.12)', 
                          borderColor: anom.severity === 'high' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.2)',
                          display: 'flex',
                          alignItems: 'start',
                          gap: '12px'
                        }}
                      >
                        <div style={{
                          padding: '6px',
                          borderRadius: '8px',
                          background: anom.severity === 'high' ? 'var(--c-rose-glow)' : 'var(--c-amber-glow)',
                          color: anom.severity === 'high' ? 'var(--c-rose)' : 'var(--c-amber)',
                          display: 'flex',
                          flexShrink: 0
                        }}>
                          <AlertTriangle size={16} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'white' }}>{anom.title}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.4 }}>
                            {anom.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* --- RECENT TRANSACTIONS LIST --- */}
              <div className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Recent Scans</h3>
                  <button 
                    onClick={() => setDashboardTab('history')} 
                    style={{ background: 'none', border: 'none', color: 'var(--c-violet)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    View All History
                  </button>
                </div>
                
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '12px 16px' }}>Store</th>
                      <th style={{ padding: '12px 16px' }}>Date</th>
                      <th style={{ padding: '12px 16px' }}>OCR Accuracy</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_transactions && stats.recent_transactions.map((tr, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px 16px', color: 'white', fontWeight: 500 }}>{tr.store_name}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{tr.date}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            background: tr.ocr_avg_confidence >= 85 ? 'var(--c-emerald-glow)' : 'var(--c-amber-glow)',
                            color: tr.ocr_avg_confidence >= 85 ? 'var(--c-emerald)' : 'var(--c-amber)',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {tr.ocr_avg_confidence}%
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--c-violet)' }}>
                          {formatCurrency(tr.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )
        )}

        {/* --- UPLOAD RECEIPT TAB VIEW --- */}
        {dashboardTab === 'upload' && (
          activeUploadReceipt ? (
            <OCRReview 
              receipt={activeUploadReceipt} 
              onSave={handleOCRReviewSave} 
              onCancel={() => setActiveUploadReceipt(null)}
            />
          ) : (
            <UploadPanel onUploadSuccess={handleUploadSuccess} />
          )
        )}

        {/* --- TIMELINE HISTORY TAB VIEW --- */}
        {dashboardTab === 'history' && (
          <History onReceiptDeleted={fetchDashboardData} />
        )}

        {/* --- CHAT BOT TAB VIEW --- */}
        {dashboardTab === 'chat' && (
          <AIChat />
        )}
      </main>

      {/* Mobile styling overrides */}
      <style>{`
        @media (max-width: 1024px) {
          .mobile-header {
            display: flex !important;
          }
          .stats-row {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .middle-row {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          .stats-row {
            grid-template-columns: 1fr !important;
          }
          .pie-layout {
            flex-direction: column !important;
            align-items: center !important;
          }
          .anomalies-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SmartSpendApp />
      </AuthProvider>
    </ToastProvider>
  );
}
