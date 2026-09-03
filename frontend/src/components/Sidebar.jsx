import { NavLink } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { 
  LayoutDashboard, 
  Video, 
  Search, 
  BarChart2, 
  Cpu, 
  Shield
} from 'lucide-react';

export default function Sidebar({ mobileMenuOpen, setMobileMenuOpen }) {
  const { isPipelineRunning, pipelineStatus } = useApp();

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 35
          }}
        />
      )}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-mobile-open' : ''}`}>
      <div className="sidebar-org-switcher">
        <div className="sidebar-org-info">
          <div className="sidebar-org-icon">
            <Shield size={15} />
          </div>
          <div>
            <div className="sidebar-org-title">OmniSight VLM</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Main Facility Hub</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-heading">Video Intelligence</div>
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="sidebar-link-content">
            <LayoutDashboard />
            <span>Overview</span>
          </div>
        </NavLink>
        <NavLink to="/cameras" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="sidebar-link-content">
            <Video />
            <span>Cameras</span>
          </div>
        </NavLink>
        <NavLink to="/search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="sidebar-link-content">
            <Search />
            <span>AI Search</span>
          </div>
          <span className="sidebar-badge">AI Engine</span>
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="sidebar-link-content">
            <BarChart2 />
            <span>Analytics</span>
          </div>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-status-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.75rem', fontWeight: 600 }}>
              <Cpu size={14} style={{ color: isPipelineRunning ? 'var(--status-warn)' : 'var(--status-live)' }} />
              <span>System Status</span>
            </div>
            <div className={`status-dot ${isPipelineRunning ? 'status-dot-warn' : 'status-dot-live'}`}></div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            <span>Video Processing</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{isPipelineRunning ? 'Active' : 'Standby'}</span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
