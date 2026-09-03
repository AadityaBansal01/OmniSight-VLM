import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useApp } from '../context/AppContext';
import { 
  Camera as CameraIcon, 
  Plus, 
  UploadCloud, 
  Video, 
  HardDrive, 
  Activity, 
  CheckCircle2, 
  Film, 
  FolderPlus,
  Play
} from 'lucide-react';

export default function Cameras() {
  const [cameras, setCameras] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const selectedCameraIdRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const { isPipelineRunning, refreshTrigger } = useApp();

  useEffect(() => {
    fetchCameras();
  }, [isPipelineRunning, refreshTrigger]);

  const [videos, setVideos] = useState([]);

  const fetchCameras = async () => {
    try {
      const [camRes, vidRes] = await Promise.all([
        apiClient.get('/api/v1/cameras').catch(() => ({ data: [] })),
        apiClient.get('/api/v1/videos').catch(() => ({ data: [] }))
      ]);
      setCameras(camRes.data || []);
      setVideos(vidRes.data || []);
      if (camRes.data?.length > 0 && !selectedCameraId) {
        setSelectedCameraId(camRes.data[0].id);
      }
    } catch (error) {
      console.error('Failed to load cameras:', error);
    }
  };

  const handleCreateCamera = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const location = e.target.location.value;
    const rtsp_url = e.target.rtsp_url.value;
    try {
      await apiClient.post('/api/v1/cameras', { name, location, rtsp_url });
      setShowAddModal(false);
      fetchCameras();
    } catch (error) {
      console.error('Failed to create camera:', error);
      alert('Failed to create camera. Is the backend server running? Error: ' + error.message);
    }
  };

  const triggerUploadForCamera = (camId) => {
    setSelectedCameraId(camId);
    selectedCameraIdRef.current = camId;
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    const targetCameraId = selectedCameraIdRef.current;
    
    if (!file || !targetCameraId) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('camera_id', targetCameraId);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/v1/videos/upload', true);
    
    // Add API key from localStorage (e.g. 2006A) or env
    const apiKey = localStorage.getItem('API_KEY') || import.meta.env?.VITE_API_KEY;
    if (apiKey) {
      xhr.setRequestHeader('X-API-Key', apiKey);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percentComplete);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        setUploadProgress(100);
        setTimeout(() => {
          setUploading(false);
          setUploadProgress(0);
          fetchCameras();
        }, 800);
      } else {
        console.error('Upload failed:', xhr.responseText);
        alert('Upload failed. Please check backend logs.');
        setUploading(false);
        setUploadProgress(0);
      }
      if (e.target) e.target.value = null;
    };

    xhr.onerror = () => {
      console.error('Upload failed');
      alert('Upload failed. Please check backend logs.');
      setUploading(false);
      setUploadProgress(0);
      if (e.target) e.target.value = null;
    };

    xhr.send(formData);
  };

  return (
    <div className="page-container">
      {/* Hidden file input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="video/mp4" 
        onChange={handleFileUpload} 
      />

      {/* Header section */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Camera Fleet</h1>
          <p className="section-subtitle">
            Manage physical surveillance feeds, configure RTSP streams, and upload local MP4 recordings
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              if (cameras.length > 0) triggerUploadForCamera(cameras[0].id);
              else alert('Please create a camera node first');
            }}
            disabled={isPipelineRunning || uploading}
          >
            <UploadCloud size={14} />
            <span>Upload Footage</span>
          </button>

          <button 
            className="btn btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={14} />
            <span>Add Camera</span>
          </button>
        </div>
      </div>

      {/* Uploading progress notification */}
      {uploading && (
        <div style={{
          background: 'var(--bg-surface-elevated)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: 500 }}>
              {uploadProgress < 100 ? 'Uploading footage...' : 'Preparing footage...'}
            </span>
          </div>
          <div className="progress-bar">
            <div className="progress-value" style={{ width: `${uploadProgress}%` }}></div>
          </div>
        </div>
      )}

      {/* Camera Grid */}
      <div className="grid-12">
        {cameras.map((cam) => {
          const camVideo = videos.find(v => v.camera_id === cam.id) || (cam.id === cameras[0]?.id ? videos[0] : null);
          return (
          <div key={cam.id} className="col-4 card" style={{ overflow: 'hidden' }}>
            {/* Camera Preview Thumbnail Canvas */}
            <div 
              onClick={() => camVideo && navigate(`/player/${camVideo.id}`)}
              style={{
                width: '100%',
                aspectRatio: '16/9',
                background: '#09090b',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid var(--border-subtle)',
                cursor: camVideo ? 'pointer' : 'default'
              }}
              title={camVideo ? "Click to view recording" : ""}
            >
              {camVideo ? (
                <img 
                  src={`/api/v1/videos/${camVideo.id}/thumbnail?t=0`}
                  alt={cam.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)' }}>
                  <CameraIcon size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.75rem' }}>No Video Feed</span>
                </div>
              )}

              {/* Status Pill Overlays */}
              <div style={{
                position: 'absolute',
                top: '0.65rem',
                left: '0.65rem',
                right: '0.65rem',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span className={`status-badge ${cam.status === 'ONLINE' ? 'status-badge-live' : cam.status === 'INDEXING' ? 'status-badge-warning' : 'status-badge-neutral'}`} style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
                  {cam.status === 'ONLINE' && <span className="status-dot status-dot-live"></span>}
                  {cam.status === 'INDEXING' && <span className="status-dot" style={{ backgroundColor: '#f59e0b' }}></span>}
                  {cam.status === 'ONLINE' ? 'READY' : cam.status || 'STANDBY'}
                </span>
                <span className="status-badge status-badge-neutral" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
                  {cam.resolution && cam.resolution !== 'N/A'
                    ? `${cam.resolution} • ${cam.fps ? Math.round(cam.fps) : 25}fps`
                    : (camVideo?.resolution ? `${camVideo.resolution} • ${camVideo.fps ? Math.round(camVideo.fps) : 25}fps` : 'No Feed')}
                </span>
              </div>
            </div>

            {/* Camera Info */}
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {cam.name}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {cam.id.slice(0, 8)}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                  {cam.location || 'Main Sector'}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.5rem',
                padding: '0.65rem',
                background: 'var(--bg-surface-elevated)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.75rem'
              }}>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Clips Stored</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cam.video_count || (camVideo ? 1 : 0)}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)' }}>Storage Allocated</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {cam.total_size_bytes 
                      ? (cam.total_size_bytes >= 1024 * 1024 * 1024
                          ? `${(cam.total_size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
                          : `${(cam.total_size_bytes / (1024 * 1024)).toFixed(1)} MB`)
                      : (camVideo?.file_size 
                          ? `${(camVideo.file_size / (1024 * 1024)).toFixed(1)} MB`
                          : '0.0 MB')}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <button 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1 }}
                  onClick={() => triggerUploadForCamera(cam.id)}
                  disabled={isPipelineRunning || uploading}
                >
                  <UploadCloud size={13} />
                  <span>Upload Footage</span>
                </button>

                {camVideo && (
                  <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => navigate(`/player/${camVideo.id}`)}
                    title="View recording"
                  >
                    <Play size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
        })}

        {cameras.length === 0 && (
          <div className="col-12 card" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
            <CameraIcon size={36} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 1rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              No Cameras Added
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0.5rem auto 1.5rem' }}>
              Create your first camera to start ingesting footage and searching physical events.
            </p>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              <span>Add Camera</span>
            </button>
          </div>
        )}
      </div>

      {/* Add Camera Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(9, 9, 11, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100
        }}>
          <div className="card" style={{ width: '420px', maxWidth: '90%' }}>
            <div className="card-header">
              <div className="card-title">Add New Camera</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleCreateCamera} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    CAMERA NAME
                  </label>
                  <input type="text" name="name" className="input" placeholder="e.g. CAM-04 (West Perimeter)" required />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    PHYSICAL LOCATION / SECTOR
                  </label>
                  <input type="text" name="location" className="input" placeholder="e.g. Loading Dock B" />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    RTSP STREAM URL (OPTIONAL)
                  </label>
                  <input type="text" name="rtsp_url" className="input" placeholder="rtsp://admin:pass@192.168.1.100/stream" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Camera</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
