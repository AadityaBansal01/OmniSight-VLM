import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import Cameras from './pages/Cameras';
import Search from './pages/Search';
import Player from './pages/Player';
import Analytics from './pages/Analytics';
import Login from './pages/Login';

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('API_KEY'));

  useEffect(() => {
    const handleAuthRequired = () => {
      setIsAuthenticated(false);
    };
    window.addEventListener('auth_required', handleAuthRequired);
    return () => window.removeEventListener('auth_required', handleAuthRequired);
  }, []);

  if (!isAuthenticated) {
    return <Login onLogin={(key) => setIsAuthenticated(true)} />;
  }

  return (
    <div className="app-layout">
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
      <main className="main-content">
        <Header setMobileMenuOpen={setMobileMenuOpen} />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/search" element={<Search />} />
          <Route path="/player/:id" element={<Player />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </div>
  );
}
