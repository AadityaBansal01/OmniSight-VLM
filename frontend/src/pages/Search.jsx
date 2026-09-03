import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  Search as SearchIcon, 
  LayoutGrid, 
  List, 
  Play, 
  Clock, 
  Video, 
  X, 
  Check, 
  Sparkles,
  ArrowRight,
  Download,
  Loader2
} from 'lucide-react';
import { formatConfidence, formatTime } from '../utils/format';

const PRESET_TAGS = [
  { label: 'Recent Events', query: '' },
  { label: 'Black SUV (Garage B1)', query: 'black SUV' },
  { label: 'Zebra Crosswalk (Gate A)', query: 'people crossing zebra crossing' },
  { label: 'Supermarket Aisle (Retail)', query: 'supermarket aisle shelves' },
  { label: 'Cash Register & Checkout', query: 'cash register counter' },
  { label: 'Bags & Luggage', query: 'carrying bags' },
];

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [threshold, setThreshold] = useState(35); // 35% minimum similarity
  const [selectedCamera, setSelectedCamera] = useState('');
  const [cameras, setCameras] = useState([]);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [activeTag, setActiveTag] = useState(initialQuery ? '' : 'Recent Events');
  const [previewEvent, setPreviewEvent] = useState(null);
  const [isLiveQuery, setIsLiveQuery] = useState(Boolean(initialQuery));
  const [aiBriefing, setAiBriefing] = useState('');
  const [aiInsights, setAiInsights] = useState([]);
  const [suggestedQueries, setSuggestedQueries] = useState([]);
  const [searchTimeMs, setSearchTimeMs] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    // Fetch camera list for filter dropdown
    apiClient.get('/api/v1/cameras')
      .then(res => setCameras(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    setQuery(qParam);
    if (qParam) {
      setActiveTag('');
      executeSearch(qParam, threshold, selectedCamera);
    } else {
      setActiveTag('Recent Events');
      executeSearch('', threshold, selectedCamera);
    }
  }, [searchParams]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && previewEvent) {
        setPreviewEvent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewEvent]);

  const executeSearch = async (searchTerm, confThreshold, camId) => {
    setLoading(true);
    try {
      if (!searchTerm || !searchTerm.trim()) {
        const params = { limit: 24 };
        if (camId) params.camera_id = camId;
        const res = await apiClient.get('/api/v1/events', { params });
        let items = res.data || [];
        setResults(items);
        setIsLiveQuery(false);
        setAiBriefing('');
        setAiInsights([]);
        setSuggestedQueries([]);
        setSearchTimeMs(0);
      } else {
        const params = {
          q: searchTerm.trim(),
          min_score: confThreshold,
          n_results: 24
        };
        if (camId) params.camera_id = camId;

        const res = await apiClient.get('/api/v1/search', { params });
        setResults(res.data.results || []);
        setIsLiveQuery(true);
        setAiBriefing(res.data.ai_summary || '');
        setAiInsights(res.data.ai_insights || []);
        setSuggestedQueries(res.data.suggested_queries || []);
        setSearchTimeMs(res.data.search_time_ms || 0);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setActiveTag('');
    setSearchParams(query ? { q: query } : {});
    executeSearch(query, threshold, selectedCamera);
  };

  const handleTagClick = (tag) => {
    setActiveTag(tag.label);
    setQuery(tag.query);
    setSearchParams(tag.query ? { q: tag.query } : {});
    executeSearch(tag.query, threshold, selectedCamera);
  };

  const formatTimestamp = (secs) => {
    if (secs == null) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  const exportEvidence = () => {
    if (!results || results.length === 0) return;
    const manifest = {
      export_title: "Sentinel CCTV Forensic Intelligence Manifest",
      timestamp: new Date().toISOString(),
      query: query || "ALL_INDEXED_EVENTS",
      confidence_threshold: `${threshold}%`,
      total_matches: results.length,
      evidence_items: results.map((r, idx) => ({
        index: idx + 1,
        camera: r.camera_name || "CAM-01",
        video_filename: r.video_filename || "surveillance.mp4",
        event_timestamp_seconds: r.timestamp,
        event_timestamp_str: r.time_str || formatTimestamp(r.timestamp),
        ai_vision_caption: r.caption,
        match_score: `${formatConfidence(r.match_score)}`,
        thumbnail_url: `/api/v1/videos/${r.video_id}/thumbnail?t=${r.timestamp}`
      }))
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sentinel_forensics_manifest_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-container">
      {/* Top Search Controls Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="section-header">
          <div>
            <h1 className="section-title">Natural Language Video Search</h1>
            <p className="section-subtitle">
              Locate specific events, objects, and behaviors across hours of surveillance footage using natural descriptions
            </p>
          </div>
        </div>

        {/* Search Input Bar */}
        <form onSubmit={handleFormSubmit} style={{ display: 'flex', gap: '0.75rem' }}>
          <div className="input-search-wrap" style={{ flex: 1 }}>
            <SearchIcon size={18} />
            <input 
              type="text" 
              className="input" 
              autoFocus
              placeholder="Search by description (e.g. 'Red car turning left', 'Person in jacket', 'Moving object')..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ padding: '0.75rem 3rem 0.75rem 2.6rem', fontSize: '0.95rem' }}
            />
            {query && (
              <button 
                type="button" 
                onClick={() => { setQuery(''); executeSearch('', threshold, selectedCamera); }}
                style={{ position: 'absolute', right: '0.85rem', color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ padding: '0 1.5rem', fontWeight: 600 }}
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>

        {/* Quick Filter Tag Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>Presets:</span>
          {PRESET_TAGS.map((tag) => (
            <button
              key={tag.label}
              type="button"
              className={`filter-chip ${activeTag === tag.label ? 'active' : ''}`}
              onClick={() => handleTagClick(tag)}
            >
              {tag.label}
            </button>
          ))}
        </div>

        {/* Filter Toolbar (Camera, Confidence, View Mode) */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          marginTop: '0.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            {/* Camera selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Camera:</span>
              <select 
                className="select"
                style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.775rem' }}
                value={selectedCamera}
                onChange={(e) => {
                  setSelectedCamera(e.target.value);
                  executeSearch(query, threshold, e.target.value);
                }}
              >
                <option value="">All Camera Nodes</option>
                {cameras.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.location || 'Node'})</option>
                ))}
              </select>
            </div>

            {/* Confidence Threshold */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minimum Match Score:</span>
              <input 
                type="range" 
                min="15" 
                max="80" 
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                onMouseUp={() => executeSearch(query, threshold, selectedCamera)}
                style={{ width: '90px', accentColor: '#ffffff', cursor: 'pointer' }}
              />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {threshold}%
              </span>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-base)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <LayoutGrid size={14} />
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setViewMode('table')}
              title="Table View"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <List size={14} />
            </button>

            <button 
              className="btn btn-secondary btn-sm"
              onClick={exportEvidence}
              disabled={results.length === 0}
              title="Export forensic evidence manifest as JSON"
              style={{ fontSize: '0.75rem', padding: '0.3rem 0.65rem', marginLeft: '0.25rem' }}
            >
              <Download size={13} />
              <span>Export Evidence</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Copilot Incident Intelligence Briefing */}
      {isLiveQuery && aiBriefing && (
        <div style={{
          background: 'linear-gradient(180deg, rgba(24, 24, 27, 0.95) 0%, rgba(18, 18, 21, 0.98) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 15px rgba(99, 102, 241, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '1.5rem'
        }}>
          {/* Glowing gradient accent bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: '#6366f1'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <div style={{
                background: 'rgba(99, 102, 241, 0.15)',
                color: '#818cf8',
                padding: '0.35rem',
                borderRadius: 'var(--radius-xs)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Sparkles size={16} />
              </div>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                AI-Assisted Search Intelligence Summary
              </span>
              <span className="status-badge status-badge-live" style={{ fontSize: '0.65rem' }}>
                Automated Scene Synthesis
              </span>
            </div>

            <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              Inference: {searchTimeMs}ms • Vision AI + Semantic Search
            </div>
          </div>

          <p style={{ fontSize: '0.875rem', lineHeight: '1.55', color: 'var(--text-secondary)', margin: 0 }}>
            {aiBriefing}
          </p>

          {/* Forensic Insights List */}
          {aiInsights && aiInsights.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '0.6rem',
              paddingTop: '0.25rem'
            }}>
              {aiInsights.map((insight, idx) => (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.775rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ color: '#6366f1', fontSize: '0.9rem' }}>✦</span>
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          )}

          {/* Suggested Follow-up Investigative Angles */}
          {suggestedQueries && suggestedQueries.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Suggested Next Angles:
              </span>
              {suggestedQueries.map((sq, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setQuery(sq);
                    executeSearch(sq, threshold, selectedCamera);
                  }}
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.2)',
                    color: '#a5b4fc',
                    borderRadius: 'var(--radius-xs)',
                    padding: '0.2rem 0.55rem',
                    fontSize: '0.725rem',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.18)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'; }}
                >
                  🔍 {sq}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span>Showing <strong style={{ color: 'var(--text-primary)' }}>{results.length}</strong> matching clips</span>
            <span className="status-badge status-badge-neutral" style={{ fontSize: '0.7rem', border: '1px solid var(--border-subtle)' }}>
              ⚡ Hybrid Dense + Lexical Fusion (&lt;80ms)
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={32} style={{ margin: '0 auto 0.75rem', animation: 'spin 1s linear infinite', color: '#6366f1' }} />
            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Searching footage vectors...</div>
            <div style={{ fontSize: '0.825rem', marginTop: '0.25rem' }}>Running dense vector retrieval and lexical re-ranking</div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid-12">
            {results.map((r) => (
              <div 
                key={r.id} 
                className="col-4 video-card"
                onClick={() => setPreviewEvent(r)}
              >
                <div className="video-thumb-wrap" style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Video size={32} style={{ color: 'var(--text-faint)' }} />
                  </div>
                  <img 
                    src={`/api/v1/videos/${r.video_id}/thumbnail?t=${r.timestamp}`} 
                    alt="Detected event keyframe" 
                    className="video-thumb-img"
                    style={{ position: 'relative', zIndex: 1 }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.style.background = '#18181c';
                    }}
                  />
                  {r.bbox && (() => {
                    try {
                      const box = typeof r.bbox === 'string' ? JSON.parse(r.bbox) : r.bbox;
                      // box is [x, y, w, h] normalized coordinates (0.0 to 1.0)
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
                          border: '2px solid var(--status-live)',
                          boxShadow: '0 0 8px rgba(52, 211, 153, 0.4)',
                          zIndex: 2,
                          pointerEvents: 'none',
                          borderRadius: '2px'
                        }} />
                      );
                    } catch (e) { return null; }
                  })()}
                  <div className="video-thumb-overlay">
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="status-badge status-badge-neutral" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
                        <span className="status-dot status-dot-live"></span>
                        {r.camera_name || 'CAM-01'}
                      </span>
                      {isLiveQuery ? (
                        <span className="status-badge status-badge-live" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
                          {formatConfidence(r.match_score)} Match
                        </span>
                      ) : (
                        <span className="status-badge status-badge-neutral" style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}>
                          Keyframe
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: '0.75rem', 
                        background: 'rgba(0,0,0,0.7)', 
                        padding: '0.15rem 0.45rem', 
                        borderRadius: 'var(--radius-xs)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}>
                        {formatTimestamp(r.timestamp)}
                      </span>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: '#ffffff',
                        color: '#09090b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Play size={10} style={{ marginLeft: '1px' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="video-card-body">
                  {/* Why this matched Box */}
                  {r.ai_match_reason && isLiveQuery && (
                    <div style={{
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      color: '#a5b4fc',
                      borderRadius: 'var(--radius-xs)',
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.725rem',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      marginBottom: '0.45rem'
                    }}>
                      <span>Why this matched: {r.ai_match_reason}</span>
                    </div>
                  )}

                  <div className="video-card-title">
                    {r.caption || r.description}
                  </div>

                  {/* Detected Scene Entities Tags */}
                  {r.detected_tags && r.detected_tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                      {r.detected_tags.map((tag, tIdx) => (
                        <span key={tIdx} style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-muted)',
                          fontSize: '0.675rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: 'var(--radius-xs)'
                        }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="video-card-meta" style={{ marginTop: '0.5rem' }}>
                    <span>{r.video_filename || 'video_stream.mp4'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {formatTimestamp(r.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View */
          <div className="card">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Keyframe</th>
                    <th>Offset</th>
                    <th>Camera Source</th>
                    <th>Semantic Caption</th>
                    <th>Match Score</th>
                    <th style={{ textAlign: 'right' }}>Forensics</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setPreviewEvent(r)}>
                      <td style={{ width: '80px' }}>
                        <div style={{ width: '64px', height: '36px', background: '#18181c', borderRadius: 'var(--radius-xs)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Video size={16} style={{ position: 'absolute', color: 'var(--text-faint)' }} />
                          <img 
                            src={`/api/v1/videos/${r.video_id}/thumbnail?t=${r.timestamp}`} 
                            alt="thumb" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          {r.bbox && (() => {
                            try {
                              const box = typeof r.bbox === 'string' ? JSON.parse(r.bbox) : r.bbox;
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
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatTimestamp(r.timestamp)}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {r.camera_name || 'CAM-01'}
                      </td>
                      <td style={{ maxWidth: '400px', color: 'var(--text-primary)' }}>
                        {r.caption || r.description}
                      </td>
                      <td>
                        {isLiveQuery ? (
                          <span className="status-badge status-badge-live">
                            {formatConfidence(r.match_score)} Match
                          </span>
                        ) : (
                          <span className="status-badge status-badge-neutral">
                            Keyframe
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm">
                          <Play size={12} />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results.length === 0 && !loading && (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <SearchIcon size={32} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>No matching events found</div>
            <div style={{ fontSize: '0.825rem', marginTop: '0.25rem' }}>
              Try lowering the similarity threshold or broadening your natural language description.
            </div>
          </div>
        )}
      </div>

      {/* Instant Video Preview Modal */}
      {previewEvent && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.85)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '1.5rem'
        }}
        onClick={() => setPreviewEvent(null)}
        >
          <div 
            className="card" 
            style={{ width: '820px', maxWidth: '100%', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span className="status-badge status-badge-live">
                  <span className="status-dot status-dot-live"></span>
                  {previewEvent.camera_name || 'Camera Node'}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>•</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                  Jumped directly to {formatTimestamp(previewEvent.timestamp)}
                </span>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewEvent(null)}>✕</button>
            </div>

            <div style={{ background: '#000000', position: 'relative', width: '100%', aspectRatio: '16/9' }}>
              <video
                src={`/api/v1/videos/${previewEvent.video_id}/stream`}
                controls
                autoPlay
                onLoadedMetadata={(e) => {
                  e.target.currentTime = previewEvent.timestamp;
                  e.target.play().catch(() => {
                    e.target.muted = true;
                    e.target.play().catch(() => {});
                  });
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {previewEvent.caption || previewEvent.description}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem' }}>
                <span className="status-badge status-badge-neutral">
                  {isLiveQuery ? `Match Score: ${formatConfidence(previewEvent.match_score)}` : 'Surveillance Keyframe'}
                </span>
                <button 
                  className="btn btn-primary"
                  onClick={() => navigate(`/player/${previewEvent.video_id}?t=${previewEvent.timestamp}`)}
                >
                  <span>Open Full Forensics</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
