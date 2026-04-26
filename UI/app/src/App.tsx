import { HashRouter, Routes, Route } from 'react-router-dom';
import { RouteCleanup } from '@/components/RouteCleanup';
import { Navigation } from '@/components/Navigation';
import { WaveBackground } from '@/components/WaveBackground';
import { FooterSection } from '@/sections/FooterSection';
import Home from '@/pages/Home';
import Platform from '@/pages/Platform';
import Security from '@/pages/Security';
import About from '@/pages/About';
import Docs from '@/pages/Docs';
import Blog from '@/pages/Blog';
import Pricing from '@/pages/Pricing';
import AccountAccess from '@/pages/AccountAccess';
import DashboardRedirect from '@/pages/DashboardRedirect';

function App() {
  return (
    <HashRouter>
      <RouteCleanup />
      <div className="site-shell relative min-h-screen">
        <WaveBackground />
        <div className="site-background-scrim" />
        <div className="relative z-10 min-h-screen">
          <Navigation />
          <main className="relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/platform" element={<Platform />} />
              <Route path="/security" element={<Security />} />
              <Route path="/about" element={<About />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/dashboard" element={<DashboardRedirect />} />
              <Route path="/login" element={<AccountAccess />} />
              <Route path="/signup" element={<AccountAccess />} />
            </Routes>
          </main>
          <FooterSection />
        </div>
      </div>
    </HashRouter>
  );
}

export default App;
