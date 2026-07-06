import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  token: string | null
  email: string | null
  login: (token: string, email: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  email: null,
  login: () => {},
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token')
  )
  const [email, setEmail] = useState<string | null>(
    () => localStorage.getItem('userEmail')
  )

  const login = (newToken: string, userEmail: string) => {
    localStorage.setItem('token', newToken)
    localStorage.setItem('userEmail', userEmail)
    setToken(newToken)
    setEmail(userEmail)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('lastAnalysis')
    setToken(null)
    setEmail(null)
  }

  return (
    <AuthContext.Provider value={{ token, email, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)