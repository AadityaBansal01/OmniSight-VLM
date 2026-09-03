import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useApp } from '../context/AppContext';
import { 
  Video, 
  Camera as CameraIcon, 
  AlertCircle, 
  Database, 
  ArrowUpRight, 
  Clock, 
  Play, 
  Cpu, 
  Layers, 
  CheckCircle2, 
  ShieldCheck,
  Search
} from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const { isPipelineRunning, refreshTrigger } = useApp();

  useEffect(() => {
    fetchDashboardData();
  }, [isPipelineRunning, refreshTrigger]);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, camerasRes, eventsRes] = await Promise.all([
        apiClient.get('/api/v1/stats').catch(() => ({ data: null })),
        apiClient.get('/api/v1/cameras').catch(() => ({ data: [] })),
        apiClient.get('/api/v1/events', { params: { limit: 8 } }).catch(() => ({ data: [] }))
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (camerasRes.data) setCameras(camerasRes.data);
      if (eventsRes.data) {
        setRecentEvents(Array.isArray(eventsRes.data) ? eventsRes.data : eventsRes.data.results || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    }
  };

  const handleQuickSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const formatTime = (secs) => {
    if (secs == null) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-container">
      {/* Top Banner / Hero Search */}
      <div style={{
        background: 'linear-gradient(180deg, var(--bg-surface-elevated) 0%, var(--bg-surface) 100%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.75rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <ShieldCheck size={16} style={{ color: 'var(--status-live)' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Cameras Active
              </span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              Sentinel Video Intelligence Hub
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Query physical surveillance footage using natural language or inspect real-time detection telemetry.
            </p>
          </div>

          <button 
            className="btn btn-primary"
            onClick={() => navigate('/cameras')}
          >
            Manage Feeds
          </button>
        </div>

        {/* Global Instant Search Bar */}
        <form onSubmit={handleQuickSearch} style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
          <div className="input-search-wrap" style={{ flex: 1 }}>
            <Search size={16} />
            <input 
              type="text" 
              className="input" 
              placeholder="Search across all cameras (e.g., 'White SUV leaving gate' or 'Person with umbrella')..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="input-kbd-shortcut">↵ ENTER</span>
          </div>
          <button type="submit" className="btn btn-secondary">
            Find Matches
          </button>
        </form>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid-12">
        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Cameras</span>
            <div className="kpi-icon-wrap"><CameraIcon size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.total_cameras ?? cameras.length}</div>
          <div className="kpi-footer">
            {stats?.total_cameras > 0 && stats?.indexed_videos > 0 ? (
              <span className="kpi-trend-positive">
                <span className="status-dot status-dot-live"></span> {stats.indexed_videos} of {stats.total_videos || stats.total_cameras} Feeds Active
              </span>
            ) : stats?.total_cameras > 0 ? (
              <span className="kpi-trend-neutral">
                <span className="status-dot" style={{ backgroundColor: '#9ca3af' }}></span> Standby (Awaiting Ingestion)
              </span>
            ) : (
              <span className="kpi-trend-neutral">
                No Provisioned Nodes
              </span>
            )}
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Indexed Footage</span>
            <div className="kpi-icon-wrap"><Video size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.total_videos ?? 0}</div>
          <div className="kpi-footer">
            <span className="kpi-trend-neutral">MP4 Stream Repositories</span>
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Detected Events</span>
            <div className="kpi-icon-wrap"><Layers size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.total_events ?? 0}</div>
          <div className="kpi-footer">
            <span className="kpi-trend-positive">
              AI Identified Events
            </span>
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Vector Store</span>
            <div className="kpi-icon-wrap"><Database size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.total_storage_mb ?? 0}<span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>MB</span></div>
          <div className="kpi-footer">
            <span className="kpi-trend-neutral">Local Vector Store</span>
          </div>
        </div>
      </div>

      {/* Main Split: Recent Activity & Live Telemetry */}
      <div className="grid-12">
        {/* Left Column: Live Event Stream (Col 8) */}
        <div className="col-8 card">
          <div className="card-header">
            <div>
              <div className="card-title">
                <Clock size={15} /> Real-time Activity Stream
              </div>
              <div className="card-description">Chronological events classified by edge vision models</div>
            </div>
            <button 
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/search')}
            >
              <span>View All</span>
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="data-table-wrap">
            {recentEvents.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '64px' }}>Frame</th>
                    <th>Timestamp</th>
                    <th>Camera Node</th>
                    <th>Classified Description</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((evt) => (
                    <tr 
                      key={evt.id} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/player/${evt.video_id}?t=${evt.timestamp}`)}
                    >
                      <td style={{ width: '64px' }}>
                        <div style={{ 
                          width: '56px', 
                          height: '32px', 
                          borderRadius: 'var(--radius-xs)', 
                          overflow: 'hidden', 
                          background: '#18181c',
                          border: '1px solid var(--border-subtle)',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Video size={14} style={{ position: 'absolute', color: 'var(--text-faint)' }} />
                          <img 
                            src={`/api/v1/videos/${evt.video_id}/thumbnail?t=${evt.timestamp}`} 
                            alt="thumb" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          {evt.bbox && (() => {
                            try {
                              const box = typeof evt.bbox === 'string' ? JSON.parse(evt.bbox) : evt.bbox;
                              const left = box[0] * 100;
                              const top = box[1] * 100;
                              const width = box[2] * 100;
                              const height = box[3] * 100;
                              return (
                                <div style={{
                                  position: 'absolute',
                                  left: `${left}%`,
                                  top: `${top}%`,
                                  width: `${width}%`,
                                  height: `${height}%`,
                                  border: '1px solid var(--status-live)',
                                  zIndex: 2,
                                  pointerEvents: 'none'
                                }} />
                              );
                            } catch (e) { return null; }
                          })()}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem' }}>
                        <span style={{ 
                          background: 'rgba(255, 255, 255, 0.05)', 
                          padding: '0.2rem 0.45rem', 
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid var(--border-subtle)'
                        }}>
                          {formatTime(evt.timestamp)}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 500 }}>
                          <span className="status-dot status-dot-live"></span>
                          <span>{evt.camera_name || 'CAM-01'}</span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '320px', color: 'var(--text-primary)' }}>
                        <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {evt.caption || evt.description}
                        </div>
                      </td>
                      <td>
                        <span className="status-badge status-badge-live">
                          READY
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/player/${evt.video_id}?t=${evt.timestamp}`);
                          }}
                        >
                          <Play size={12} />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={28} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>No Events Logged Yet</div>
                <div style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Upload footage to trigger the automatic motion & vision indexing pipeline.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Engine Specs & Telemetry (Col 4) */}
        <div className="col-4" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* System Health Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Cpu size={15} /> System Health
              </div>
              <span className="status-badge status-badge-live">Healthy</span>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Core AI Engine</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Online</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Video Ingestion</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.65rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Search Database</span>
                <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Avg Search Speed</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                  {stats?.avg_query_latency_ms != null ? `${stats.avg_query_latency_ms}ms` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick System Action Banner */}
          <div className="card" style={{ background: 'var(--bg-surface-elevated)' }}>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Need to ingest new footage?
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Drop raw CCTV streams or MP4 video recordings into any provisioned camera node to extract semantic event indexes.
              </p>
              <button 
                className="btn btn-secondary" 
                style={{ width: '100%', marginTop: '0.25rem' }}
                onClick={() => navigate('/cameras')}
              >
                Go to Camera Feeds
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
