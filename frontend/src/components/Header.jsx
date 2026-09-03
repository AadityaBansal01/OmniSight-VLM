import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Search, ChevronRight, UploadCloud, Menu, Lock } from 'lucide-react';

export default function Header({ setMobileMenuOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isPipelineRunning, pipelineStatus } = useApp();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const getPageTitle = (pathname) => {
    if (pathname === '/') return 'System Overview';
    if (pathname.startsWith('/cameras')) return 'Live Feeds & Nodes';
    if (pathname.startsWith('/search')) return 'Natural Language Search';
    if (pathname.startsWith('/player')) return 'Forensics Video Player';
    if (pathname.startsWith('/analytics')) return 'Surveillance Intelligence';
    return 'Dashboard';
  };

  return (
    <header className="top-header">
      <div className="header-breadcrumbs">
        <button 
          className="mobile-nav-toggle"
          onClick={() => setMobileMenuOpen(true)}
        >
          <Menu size={18} />
        </button>
        <span>OmniSight Enterprise</span>
        <ChevronRight size={14} style={{ opacity: 0.4 }} />
        <span className="current">{getPageTitle(location.pathname)}</span>
      </div>

      <div className="header-actions">
        <div 
          onClick={() => navigate('/search')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.35rem 0.75rem',
            cursor: 'pointer',
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            width: '240px',
            justifyContent: 'space-between',
            transition: 'border-color 120ms ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-default)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={14} />
            <span>Search footage...</span>
          </div>
          <span className="input-kbd-shortcut" style={{ position: 'static' }}>⌘K</span>
        </div>

        <div className={`status-badge ${isPipelineRunning ? 'status-badge-warn' : 'status-badge-live'}`}>
          <div className={`status-dot ${isPipelineRunning ? 'status-dot-warn' : 'status-dot-live'}`}></div>
          <span>{isPipelineRunning ? `${pipelineStatus?.stage || 'Indexing'}` : 'Edge Node 01 Online'}</span>
        </div>

        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/cameras')}
          title="Upload or manage footage"
        >
          <UploadCloud size={14} />
          <span>Upload</span>
        </button>

        <button 
          className="btn btn-ghost btn-sm"
          onClick={() => {
            localStorage.removeItem('API_KEY');
            window.dispatchEvent(new Event('auth_required'));
          }}
          title="Lock Surveillance Terminal (Passkey 2006A)"
          style={{ padding: '0.4rem 0.5rem', color: 'var(--text-muted)' }}
        >
          <Lock size={13} />
        </button>
      </div>
    </header>
  );
}
