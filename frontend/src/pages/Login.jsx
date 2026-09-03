import { useState } from 'react';
import { Shield, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import apiClient from '../api/client';

export default function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Temporarily set the API key in local storage to test it
      localStorage.setItem('API_KEY', password);
      // We ping the stats endpoint as a health check to verify the password
      await apiClient.get('/api/v1/stats');
      
      onLogin(password);
    } catch (err) {
      setError('Invalid system password. Please try again.');
      localStorage.removeItem('API_KEY');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100vw',
      background: 'var(--bg-base)',
      backgroundImage: 'radial-gradient(circle at top right, rgba(99, 102, 241, 0.1), transparent 40%), radial-gradient(circle at bottom left, rgba(52, 211, 153, 0.05), transparent 40%)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }}>
      <div className="glass" style={{
        borderRadius: 'var(--radius-xl)',
        padding: '3rem',
        width: '100%',
        maxWidth: '440px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            background: 'var(--accent-indigo-surface)',
            border: '1px solid var(--accent-indigo-border)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '1.5rem',
            boxShadow: '0 0 20px rgba(99, 102, 241, 0.2)'
          }}>
            <Shield size={36} color="var(--accent-indigo)" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '600', margin: '0 0 0.5rem 0', letterSpacing: '-0.02em' }}>OmniSight VLM</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>Central Video Intelligence Hub</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              System Password
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '50%', left: '1.25rem', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password to access"
                style={{
                  width: '100%',
                  padding: '1rem 3rem',
                  background: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                  boxShadow: 'var(--shadow-inner)'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--accent-indigo)';
                  e.target.style.background = 'rgba(0, 0, 0, 0.8)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'var(--border-default)';
                  e.target.style.background = 'rgba(0, 0, 0, 0.5)';
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '1.25rem',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {error && (
              <p style={{ color: 'var(--status-alert)', fontSize: '0.85rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--status-alert)' }} />
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            style={{
              background: isLoading ? 'var(--bg-surface-elevated)' : 'var(--accent-primary)',
              color: isLoading ? 'var(--text-muted)' : 'var(--accent-inverse)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isLoading || !password ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s ease',
              opacity: isLoading || !password ? 0.7 : 1,
              marginTop: '0.5rem'
            }}
            onMouseEnter={(e) => {
              if (!isLoading && password) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 255, 255, 0.15)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {isLoading ? 'Authenticating...' : 'Access Dashboard'}
            {!isLoading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
