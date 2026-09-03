import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  Activity, 
  TrendingUp, 
  Layers, 
  ShieldCheck, 
  Zap, 
  Clock,
  RefreshCw 
} from 'lucide-react';

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.get('/api/v1/stats');
      if (res.data) {
        setStats(res.data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Live auto-polling every 5 seconds
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real timeline data from backend or fallback empty template
  const eventTrendData = stats?.event_timeline && stats.event_timeline.length > 0 
    ? stats.event_timeline 
    : [
        { time: '00:00', events: 0 },
        { time: '04:00', events: 0 },
        { time: '08:00', events: 0 },
        { time: '12:00', events: 0 },
        { time: '16:00', events: 0 },
        { time: '20:00', events: 0 },
        { time: '23:59', events: 0 },
      ];

  // Real classification categories parsed from indexed events
  const categoryData = stats?.category_distribution && stats.category_distribution.length > 0
    ? stats.category_distribution
    : [
        { category: 'No Indexed Data', count: 0 }
      ];

  return (
    <div className="page-container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Surveillance Intelligence & Telemetry</h1>
          <p className="section-subtitle">
            Dynamic physical event trends, classification distribution, and vision pipeline throughput
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={fetchStats}
            disabled={isRefreshing}
            title="Refresh metrics immediately"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'spin-icon' : ''} />
            <span>Refresh</span>
          </button>
          <span className="status-badge status-badge-live">
            <span className="status-dot status-dot-live"></span>
            Auto-refresh • 5s
          </span>
        </div>
      </div>

      {/* KPI Overview Strip */}
      <div className="grid-12">
        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Total Detected Events</span>
            <div className="kpi-icon-wrap"><Activity size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.total_events ?? 0}</div>
          <div className="kpi-footer">
            <span className="kpi-trend-positive">Across {stats?.total_videos ?? 0} ingested streams</span>
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Motion Pruning Rate</span>
            <div className="kpi-icon-wrap"><TrendingUp size={14} /></div>
          </div>
          <div className="kpi-value">
            {stats?.motion_pruning_rate != null ? `${stats.motion_pruning_rate}%` : '0.0%'}
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend-neutral">Static frames filtered before AI analysis</span>
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Avg Query Latency</span>
            <div className="kpi-icon-wrap"><Zap size={14} /></div>
          </div>
          <div className="kpi-value">
            {stats?.avg_query_latency_ms != null ? `${stats.avg_query_latency_ms}ms` : 'N/A'}
          </div>
          <div className="kpi-footer">
            <span className="kpi-trend-positive">Local Semantic Search Index</span>
          </div>
        </div>

        <div className="col-3 kpi-card">
          <div className="kpi-header">
            <span className="kpi-label">Indexed Videos</span>
            <div className="kpi-icon-wrap"><Layers size={14} /></div>
          </div>
          <div className="kpi-value">{stats?.indexed_videos ?? 0}</div>
          <div className="kpi-footer">
            <span className="kpi-trend-neutral">Completed AI indexing</span>
          </div>
        </div>
      </div>

      {/* Main Charts */}
      <div className="grid-12">
        {/* Activity Timeline (Col 8) */}
        <div className="col-8 card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <Clock size={14} /> 24-Hour Detection Timeline
              </div>
              <div className="card-description">Classified keyframe events</div>
            </div>
          </div>

          <div className="card-body" style={{ flex: 1, minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={eventTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="eventGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  stroke="var(--text-faint)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={{ stroke: 'var(--border-subtle)' }} 
                />
                <YAxis 
                  stroke="var(--text-faint)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false} 
                />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.04)" vertical={false} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#121215', 
                    borderColor: 'rgba(255, 255, 255, 0.12)', 
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: '#f4f4f5',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }} 
                  itemStyle={{ color: '#ffffff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="events" 
                  stroke="#ffffff" 
                  strokeWidth={2} 
                  fill="url(#eventGrad)" 
                  name="Classified Semantic Events"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Classification Breakdown (Col 4) */}
        <div className="col-4 card" style={{ minHeight: '380px', display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <Layers size={14} /> Detected Categories
              </div>
              <div className="card-description">Based on indexed event captions</div>
            </div>
          </div>

          <div className="card-body" style={{ flex: 1, minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="category" 
                  type="category" 
                  stroke="var(--text-secondary)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  width={130}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                  contentStyle={{ 
                    backgroundColor: '#121215', 
                    borderColor: 'rgba(255, 255, 255, 0.12)', 
                    borderRadius: '6px',
                    fontSize: '0.8rem'
                  }}
                />
                <Bar dataKey="count" fill="#ffffff" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
