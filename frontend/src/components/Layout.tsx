import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { BrainCircuit, FileSearch, History, MessageSquare, LogOut } from 'lucide-react'

const navItems = [
  { to: '/', icon: FileSearch, label: 'Analyze' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { email, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/auth')
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex flex-col border-r border-slate-800 bg-slate-950 shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-indigo-400" size={22} />
            <span className="text-white font-bold text-lg" style={{ fontFamily: 'var(--font-display)' }}>
              Career<span className="text-indigo-400">AI</span>
            </span>
          </div>
          <p className="text-slate-500 text-xs mt-1">Resume Intelligence</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300 font-medium'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="px-3 py-2 mb-1">
            <p className="text-slate-500 text-xs truncate">{email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={17} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}