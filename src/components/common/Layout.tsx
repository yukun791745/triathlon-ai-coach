import { Link, useLocation } from 'react-router-dom'

type LayoutProps = {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🏊🚴🏃</span>
            <span className="font-bold text-lg text-slate-800">Triathlon AI Coach</span>
          </Link>
          <nav className="flex gap-4">
            <NavLink to="/" current={location.pathname === '/'}>ホーム</NavLink>
            <NavLink to="/data" current={location.pathname === '/data'}>データ</NavLink>
          </nav>
        </div>
      </header>
      
      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {children}
      </main>
      
      {/* フッター */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-4 py-4 text-center text-sm text-slate-500">
          © 2026 Triathlon AI Coach
        </div>
      </footer>
    </div>
  )
}

function NavLink({ to, current, children }: { to: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        current 
          ? 'bg-blue-100 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </Link>
  )
}
