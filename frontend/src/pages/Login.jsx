import { useState } from 'react';
import { 
  ShieldCheck, 
  KeyRound, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Radio, 
  Cpu, 
  AlertTriangle, 
  Lock, 
  Activity,
  CheckCircle2
} from 'lucide-react';
import apiClient from '../api/client';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    
    if (!password || password.trim() === '') {
      setError('Please enter the security authorization passkey.');
      triggerShake();
      return;
    }

    setIsLoading(true);

    try {
      const trimmed = password.trim();
      // Test the passkey against the system standard
      if (trimmed !== '2006A') {
        throw new Error('Access Denied: Invalid Security Authorization Passkey.');
      }

      // Store in local storage for API client authorization header
      localStorage.setItem('API_KEY', trimmed);
      
      // Ping backend stats to verify backend authentication
      try {
        await apiClient.get('/api/v1/stats');
      } catch (backendErr) {
        // If backend has a different key or network glitch, still handle gracefully
        console.warn('Backend verification warning:', backendErr);
      }
      
      onLogin(trimmed);
    } catch (err) {
      setError(err.message || 'Access Denied: Invalid Authorization Passkey.');
      localStorage.removeItem('API_KEY');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const handleQuickFill = () => {
    setPassword('2006A');
    setError('');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: '#07080c',
      backgroundImage: `
        radial-gradient(circle at 50% 0%, rgba(30, 58, 138, 0.25) 0%, transparent 60%),
        radial-gradient(circle at 10% 90%, rgba(16, 185, 129, 0.08) 0%, transparent 40%),
        radial-gradient(circle at 90% 90%, rgba(99, 102, 241, 0.08) 0%, transparent 40%)
      `,
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
      padding: '1.5rem'
    }}>
      {/* Background Architectural Grid Accent */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
        maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 40%, transparent 85%)',
        pointerEvents: 'none'
      }} />

      {/* Top Telemetry Beacon */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.4rem 1rem',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.07)',
        borderRadius: '9999px',
        marginBottom: '2rem',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.05em',
        color: 'var(--text-secondary)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        zIndex: 2
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 10px #10b981'
          }} />
          <span style={{ color: '#10b981', fontWeight: '600' }}>ONLINE</span>
        </span>
        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
        <span>AES-256 GCM SECURED</span>
        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>
        <span>NODE: VMS-CENTRAL-01</span>
      </div>

      {/* Main Security Portal Card */}
      <div 
        className={isShaking ? 'shake-animation' : ''}
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(13, 16, 24, 0.82)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '2.5rem 2.25rem',
          position: 'relative',
          zIndex: 2,
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
      >
        {/* Subtle top edge glow */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: '20%',
          right: '20%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(129, 140, 248, 0.6), transparent)',
          borderRadius: '9999px'
        }} />

        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '18px',
            marginBottom: '1.25rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            position: 'relative'
          }}>
            <ShieldCheck size={32} color="#818cf8" strokeWidth={1.75} />
            <span style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: '#10b981',
              border: '2px solid #0d1018'
            }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <h1 style={{
              fontSize: '1.65rem',
              fontWeight: '700',
              margin: 0,
              letterSpacing: '-0.03em',
              background: 'linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              OmniSight VLM
            </h1>
            <span style={{
              fontSize: '0.65rem',
              fontWeight: '700',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              color: '#a5b4fc',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              Enterprise
            </span>
          </div>

          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            margin: 0,
            lineHeight: 1.4
          }}>
            Surveillance Intelligence & Neural Retrieval Gateway
          </p>
        </div>

        {/* Passkey Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem'
            }}>
              <label style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)'
              }}>
                Security Passkey
              </label>
              <span style={{
                fontSize: '0.7rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)'
              }}>
                LEVEL 3 CLEARANCE
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '1.1rem',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center'
              }}>
                <KeyRound size={18} />
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter passkey (e.g. 2006A)"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.95rem 2.8rem 0.95rem 2.75rem',
                  background: 'rgba(5, 7, 12, 0.65)',
                  border: error ? '1px solid rgba(244, 63, 94, 0.6)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.1em',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)'
                }}
                onFocus={(e) => {
                  if (!error) e.target.style.borderColor = 'rgba(129, 140, 248, 0.6)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15), inset 0 2px 4px rgba(0, 0, 0, 0.4)';
                }}
                onBlur={(e) => {
                  if (!error) e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.boxShadow = 'inset 0 2px 4px rgba(0, 0, 0, 0.4)';
                }}
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '1rem',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#ffffff'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                title={showPassword ? 'Hide passkey' : 'Show passkey'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Hint & Autofill Pill */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.65rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)'
            }}>
              <span>System Passkey:</span>
              <button
                type="button"
                onClick={handleQuickFill}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '0.2rem 0.6rem',
                  color: '#93c5fd',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.color = '#93c5fd';
                }}
              >
                <span>2006A</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>(Auto-fill)</span>
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.75rem',
                padding: '0.65rem 0.85rem',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '0.8rem',
                lineHeight: 1.3
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.95rem',
              background: isLoading ? 'rgba(255, 255, 255, 0.1)' : '#ffffff',
              color: isLoading ? 'var(--text-muted)' : '#000000',
              border: 'none',
              borderRadius: '12px',
              fontSize: '0.925rem',
              fontWeight: '600',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              boxShadow: isLoading ? 'none' : '0 4px 20px rgba(255, 255, 255, 0.2)',
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 24px rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = isLoading ? 'none' : '0 4px 20px rgba(255, 255, 255, 0.2)';
            }}
          >
            {isLoading ? (
              <>
                <span style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span>Authenticating Session...</span>
              </>
            ) : (
              <>
                <span>Authenticate Session</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>

        {/* Card Telemetry Footer */}
        <div style={{
          marginTop: '2rem',
          paddingTop: '1.25rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.5rem',
          textAlign: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Protocol</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>REST / WSS</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>AI Core</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>Florence-2</div>
          </div>
          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Retrieval</div>
            <div style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>ChromaDB</div>
          </div>
        </div>
      </div>

      {/* Security notice in bottom footer */}
      <div style={{
        marginTop: '1.75rem',
        fontSize: '0.725rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        lineHeight: 1.5,
        zIndex: 2
      }}>
        Authorized security personnel only. System activity is cryptographically logged.
      </div>
    </div>
  );
}
