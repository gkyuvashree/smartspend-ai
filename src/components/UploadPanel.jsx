import React, { useState, useRef, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { api, formatCurrency } from '../services/api';
import { useToast } from '../context/ToastContext';

export default function UploadPanel({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  
  // Advanced progressive scanning states
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStage, setScanStage] = useState('');
  
  const fileInputRef = useRef(null);
  const { showSuccess, showError } = useToast();
  const progressTimerRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (selectedFile) => {
    if (!selectedFile) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!validTypes.includes(selectedFile.type)) {
      showError("Invalid file type. Please upload a JPG or PNG receipt image.");
      return;
    }
    
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setScanning(false);
    setScanProgress(0);
    setScanStage('');
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
  };

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const startProgressSimulation = () => {
    setScanProgress(5);
    setScanStage('[OpenCV] Initiating perspective crop contour scan...');
    
    let currentProgress = 5;
    progressTimerRef.current = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 8) + 2;
      
      if (currentProgress >= 98) {
        currentProgress = 98;
        clearInterval(progressTimerRef.current);
      }
      
      setScanProgress(currentProgress);
      
      // Update text descriptive logs dynamically
      if (currentProgress >= 15 && currentProgress < 35) {
        setScanStage('[OpenCV] Normalizing brightness & filtering shadow glare...');
      } else if (currentProgress >= 35 && currentProgress < 55) {
        setScanStage('[OpenCV] Binarizing image & sharpening character contours...');
      } else if (currentProgress >= 55 && currentProgress < 80) {
        setScanStage('[EasyOCR] Processing characters using Deep Neural Net...');
      } else if (currentProgress >= 80) {
        setScanStage('[AI NLP] Structuring items, quantity multipliers & sales tax...');
      }
    }, 350);
  };

  const handleScan = async () => {
    if (!file) return;
    
    setScanning(true);
    startProgressSimulation();
    
    try {
      const receiptData = await api.receipts.upload(file);
      
      // Complete progress bar
      setScanProgress(100);
      setScanStage('OCR Extraction Complete!');
      
      setTimeout(() => {
        showSuccess(`Successfully processed receipt from ${receiptData.store_name} (${formatCurrency(receiptData.total_amount)})`);
        onUploadSuccess(receiptData);
        handleClear();
      }, 500);
      
    } catch (err) {
      showError(err.message || "Failed to scan receipt image.");
      setScanning(false);
      setScanProgress(0);
      setScanStage('');
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    }
  };

  return (
    <div className="glass-card stat-card" style={{ padding: '30px' }}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        accept="image/png, image/jpeg, image/jpg"
      />
      
      {!preview ? (
        // --- DRAG AND DROP ZONE ---
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          style={{
            border: dragActive ? '2px dashed var(--c-violet)' : '2px dashed rgba(255,255,255,0.08)',
            background: dragActive ? 'rgba(139, 92, 246, 0.05)' : 'rgba(0,0,0,0.15)',
            borderRadius: '12px',
            padding: '50px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'var(--transition-smooth)'
          }}
          onMouseEnter={(e) => {
            if (!dragActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            if (!dragActive) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.03)',
            color: dragActive ? 'var(--c-violet)' : 'var(--text-secondary)',
            marginBottom: '16px',
            transition: 'var(--transition-smooth)'
          }}>
            <UploadCloud size={28} />
          </div>
          
          <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', fontWeight: 500 }}>
            {dragActive ? "Drop your receipt here" : "Drag & drop receipt image"}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
            Supports JPG, JPEG, and PNG receipt formats
          </p>
          <button className="btn-glass" type="button" style={{ pointerEvents: 'none' }}>
            Browse local file
          </button>
        </div>
      ) : (
        // --- IMAGE PREVIEW & SCANNING VIEW ---
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            position: 'relative',
            borderRadius: '12px',
            overflow: 'hidden',
            maxHeight: '380px',
            height: '380px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--border-glass)'
          }}>
            <img 
              src={preview} 
              alt="Receipt Preview" 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                opacity: scanning ? 0.4 : 1,
                transition: 'opacity 0.3s'
              }}
            />
            
            {/* pulse vertical scanner glow line */}
            {scanning && (
              <>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'linear-gradient(to bottom, rgba(139,92,246,0) 0%, rgba(139,92,246,0.08) 100%)',
                  pointerEvents: 'none'
                }} />
                
                <div style={{
                  position: 'absolute',
                  width: '100%',
                  height: '4px',
                  background: 'var(--c-violet)',
                  boxShadow: '0 0 15px 4px var(--c-violet)',
                  left: 0,
                  top: 0,
                  animation: 'scanner-sweep 2.2s ease-in-out infinite'
                }} />
                
                {/* Advanced Loading Animation Box */}
                <div style={{
                  position: 'absolute',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  background: 'rgba(6,9,15,0.92)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid var(--border-glass)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                  padding: '24px',
                  borderRadius: '16px',
                  color: 'white',
                  width: '320px',
                  zIndex: 20
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                    <Loader2 size={18} className="animate-spin accent-text-violet" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Analyzing Receipt...</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--c-violet)', fontWeight: 700 }}>
                      {scanProgress}%
                    </span>
                  </div>
                  
                  {/* Linear Progress Bar */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${scanProgress}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #8B5CF6 0%, #a78bfa 100%)',
                      boxShadow: '0 0 8px rgba(139,92,246,0.6)',
                      borderRadius: '3px',
                      transition: 'width 0.3s ease-out'
                    }} />
                  </div>
                  
                  {/* Status Progress Log Stage */}
                  <div style={{
                    width: '100%',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    textAlign: 'left',
                    fontFamily: 'monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {scanStage}
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* CONTROL BAR */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button 
              className="btn-glass" 
              onClick={handleClear} 
              disabled={scanning}
            >
              Clear
            </button>
            <button 
              className="btn-glass btn-primary" 
              onClick={handleScan}
              disabled={scanning}
              style={{ padding: '12px 30px' }}
            >
              <Sparkles size={16} />
              Run Upgraded AI OCR
            </button>
          </div>
        </div>
      )}
      
      {/* CSS scanner animation injected to DOM in React */}
      <style>{`
        @keyframes scanner-sweep {
          0% { top: 0%; }
          50% { top: 98%; }
          100% { top: 0%; }
        }
        .animate-spin {
          animation: spin 1.2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
