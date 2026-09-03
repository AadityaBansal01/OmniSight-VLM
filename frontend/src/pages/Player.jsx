import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Maximize2, 
  Volume2, 
  Clock, 
  Calendar, 
  Video, 
  Share2, 
  Download, 
  Sliders, 
  Layers, 
  Eye
} from 'lucide-react';
import { formatConfidence } from '../utils/format';

export default function Player() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const targetTime = searchParams.get('t');

  const [video, setVideo] = useState(null);
  const [events, setEvents] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [activeEvent, setActiveEvent] = useState(null);

  const [isMuted, setIsMuted] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);
  const navigate = useNavigate();

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const copyShareLink = () => {
    const url = `${window.location.origin}/player/${id}?t=${currentTime.toFixed(1)}`;
    navigator.clipboard?.writeText(url);
    showToast(`Link copied — ${formatTime(currentTime)}`);
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `sentinel_snapshot_${video?.filename || id}_${currentTime.toFixed(1)}s.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
      link.remove();
      showToast(`Snapshot saved — ${formatTime(currentTime)}`);
    } catch (err) {
      console.error('Snapshot failed:', err);
    }
  };

  useEffect(() => {
    fetchVideoAndEvents();
  }, [id]);

  const toggleMute = () => {
    if (!videoRef.current) return;
    const next = !videoRef.current.muted;
    videoRef.current.muted = next;
    setIsMuted(next);
  };

  const toggleFullscreen = () => {
    const el = videoContainerRef.current || videoRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skipTime(-5);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        skipTime(5);
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === '[') {
        handleSpeedChange(Math.max(0.25, playbackRate - 0.25));
      } else if (e.key === ']') {
        handleSpeedChange(Math.min(3.0, playbackRate + 0.25));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [duration, isPlaying, playbackRate]);

  const fetchVideoAndEvents = async () => {
    try {
      const [eventsRes, videoRes] = await Promise.all([
        apiClient.get(`/api/v1/events/${id}`).catch(() => ({ data: [] })),
        apiClient.get(`/api/v1/videos/${id}`).catch(() => ({ data: null })),
      ]);
      setEvents(eventsRes.data || []);
      if (videoRes.data) {
        setVideo(videoRes.data);
      }
    } catch (error) {
      console.error('Failed to load video events:', error);
    }
  };

  const [jumpNotice, setJumpNotice] = useState(null);

  useEffect(() => {
    if (targetTime && videoRef.current) {
      const t = parseFloat(targetTime);
      const applySeek = () => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = t;
        setCurrentTime(t);
        setJumpNotice(`Jumped directly to ${formatTime(t)}`);
        setTimeout(() => setJumpNotice(null), 4000);

        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        });
      };

      if (videoRef.current.readyState >= 1) {
        applySeek();
      } else {
        const el = videoRef.current;
        const runOnce = () => {
          el.removeEventListener('loadedmetadata', runOnce);
          el.removeEventListener('canplay', runOnce);
          applySeek();
        };
        el.addEventListener('loadedmetadata', runOnce, { once: true });
        el.addEventListener('canplay', runOnce, { once: true });
      }
    }
  }, [targetTime, id]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    setCurrentTime(t);

    const near = events.find(e => Math.abs(e.timestamp - t) < 2);
    setActiveEvent(near || null);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (secs) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = secs;
    setCurrentTime(secs);
    videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const skipTime = (offset) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + offset));
    seekTo(newTime);
  };

  const handleSpeedChange = (rate) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatTime = (secs) => {
    if (secs == null || isNaN(secs)) return '00:00';
    const mins = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="page-container" style={{ paddingBottom: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={14} />
            <span>Back</span>
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {video?.camera_name || 'Camera Feed'}
              </h1>
              <span className="status-badge status-badge-neutral">
                {video?.filename || 'video.mp4'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Recorded footage with indexed event markers
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {toastMessage && (
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              padding: '0.25rem 0.65rem',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.75rem',
              fontWeight: 500,
              animation: 'fadeIn 0.2s ease-out'
            }}>
              {toastMessage}
            </span>
          )}

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={captureFrame}
            title="Download high-resolution forensic snapshot"
          >
            <Download size={13} />
            <span>Capture Frame</span>
          </button>

          <button 
            className="btn btn-secondary btn-sm" 
            onClick={copyShareLink}
            title="Copy shareable link with current timestamp"
          >
            <Share2 size={13} />
            <span>Share Link</span>
          </button>
        </div>
      </div>

      <div className="grid-12">
        <div className="col-8" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          
          <div 
            ref={videoContainerRef}
            style={{
            position: 'relative',
            background: '#000000',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)'
          }}>
            {jumpNotice && (
              <div style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#ffffff',
                color: '#09090b',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                fontWeight: 600,
                fontSize: '0.775rem',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
              }}>
                <span>📍 {jumpNotice}</span>
              </div>
            )}

            <div style={{
              position: 'absolute',
              top: '1rem',
              left: '1rem',
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(9, 9, 11, 0.75)',
              backdropFilter: 'blur(8px)',
              padding: '0.35rem 0.65rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)'
            }}>
              <span className="status-dot status-dot-live"></span>
              <span style={{ fontWeight: 600, color: '#ffffff' }}>{video?.camera_name || 'CAM-01'}</span>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{formatTime(currentTime)}</span>
            </div>

            <video 
              ref={videoRef}
              src={`/api/v1/videos/${id}/stream`}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onClick={togglePlay}
              style={{
                width: '100%',
                aspectRatio: '16/9',
                display: 'block',
                cursor: 'pointer',
                objectFit: 'contain',
                background: '#000000'
              }}
            />

            <div style={{
              position: 'relative',
              height: '24px',
              background: 'rgba(18, 18, 21, 0.95)',
              borderTop: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '0 0.5rem'
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              if (duration) seekTo(pct * duration);
            }}
            >
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', position: 'relative' }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                  background: '#ffffff',
                  borderRadius: '2px'
                }}></div>

                {events.map((evt) => {
                  const pct = duration ? (evt.timestamp / duration) * 100 : 0;
                  return (
                    <div 
                      key={evt.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        seekTo(evt.timestamp);
                      }}
                      title={`${formatTime(evt.timestamp)}: ${evt.description}`}
                      style={{
                        position: 'absolute',
                        left: `${Math.min(99, Math.max(0, pct))}%`,
                        top: '-4px',
                        width: '3px',
                        height: '12px',
                        background: 'var(--status-warn)',
                        borderRadius: '1px',
                        cursor: 'pointer',
                        zIndex: 5
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div style={{
              padding: '0.65rem 1rem',
              background: 'var(--bg-surface)',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={togglePlay}
                  style={{ width: '32px', height: '32px', padding: 0 }}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
                </button>

                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => skipTime(-5)} 
                  title="Rewind 5s"
                >
                  <RotateCcw size={14} />
                  <span style={{ fontSize: '0.7rem' }}>5s</span>
                </button>

                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => skipTime(5)} 
                  title="Forward 5s"
                >
                  <RotateCw size={14} />
                  <span style={{ fontSize: '0.7rem' }}>5s</span>
                </button>

                <div style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {[0.5, 1, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    className={`btn btn-sm ${playbackRate === rate ? 'btn-secondary' : 'btn-ghost'}`}
                    style={{ fontSize: '0.7rem', padding: '0.2rem 0.45rem' }}
                    onClick={() => handleSpeedChange(rate)}
                  >
                    {rate}x
                  </button>
                ))}

                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={toggleMute} 
                  title="Toggle audio mute (M)"
                  style={{ padding: '0.25rem 0.45rem' }}
                >
                  <Volume2 size={14} style={{ opacity: isMuted ? 0.35 : 1 }} />
                </button>

                <button 
                  className="btn btn-ghost btn-sm" 
                  onClick={toggleFullscreen} 
                  title="Toggle fullscreen (F)"
                  style={{ padding: '0.25rem 0.45rem' }}
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 0.5rem',
            fontSize: '0.725rem',
            color: 'var(--text-muted)'
          }}>
            <span>⌨ Space (Play/Pause) • ← / → (±5s) • F (Fullscreen) • M (Mute) • [ / ] (Speed)</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>Playback Rate: {playbackRate}x</span>
          </div>

          {activeEvent && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="status-badge status-badge-warn">Detected</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {activeEvent.caption || activeEvent.description}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Timestamp: {formatTime(activeEvent.timestamp)} • {activeEvent.confidence != null ? (activeEvent.confidence >= 99.9 ? 'Indexed event' : `Match: ${formatConfidence(activeEvent.confidence)}`) : 'Keyframe Verified'}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        <div className="col-4 card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                <Layers size={14} /> Detected Video Events
              </div>
              <div className="card-description">Click any event to seek directly</div>
            </div>
            <span className="status-badge status-badge-neutral">{events.length}</span>
          </div>

          <div style={{ maxHeight: '520px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {events.map((evt, idx) => (
              <div
                key={evt.id}
                onClick={() => seekTo(evt.timestamp)}
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '0.75rem',
                  transition: 'background var(--ease-fast)',
                  background: Math.abs(currentTime - evt.timestamp) < 2 ? 'var(--bg-surface-hover)' : 'transparent'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-surface-hover)'}
                onMouseLeave={(e) => {
                  if (Math.abs(currentTime - evt.timestamp) >= 2) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <div style={{
                  width: '60px',
                  height: '34px',
                  background: '#18181c',
                  borderRadius: 'var(--radius-xs)',
                  overflow: 'hidden',
                  flexShrink: 0,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Video size={14} style={{ position: 'absolute', color: 'var(--text-faint)' }} />
                  <img 
                    src={`/api/v1/videos/${id}/thumbnail?t=${evt.timestamp}`}
                    alt="keyframe"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'relative', zIndex: 1 }}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {formatTime(evt.timestamp)}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {evt.confidence === 100 ? `Frame #${idx + 1}` : (evt.confidence != null ? formatConfidence(evt.confidence) : `Frame #${idx + 1}`)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {evt.caption || evt.description}
                  </div>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                No events currently extracted for this clip.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
