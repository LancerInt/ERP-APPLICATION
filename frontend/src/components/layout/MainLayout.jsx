import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

export default function MainLayout({ children, breadcrumbs = [] }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content area with breadcrumbs */}
        <main className="flex-1 overflow-auto">
          {breadcrumbs.length > 0 && (
            <div className="px-6 py-4 bg-white border-b border-slate-200">
              <nav className="flex items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {idx > 0 && <span className="text-slate-400">/</span>}
                    {crumb.href ? (
                      <a
                        href={crumb.href}
                        className="text-blue-600 hover:text-blue-800 transition"
                      >
                        {crumb.label}
                      </a>
                    ) : (
                      <span className="text-slate-700 font-medium">{crumb.label}</span>
                    )}
                  </div>
                ))}
              </nav>
            </div>
          )}

          {/* Page content */}
          <div className="px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
