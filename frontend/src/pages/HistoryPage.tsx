import React, { useEffect, useState } from 'react'
import { Trash2, ChevronRight, Loader2, Calendar, Target } from 'lucide-react'
import api from '../api/client'

interface HistoryItem {
  id: number
  target_role: string
  overall_score: number
  feedback: string
  created_at: string
}

interface HistoryDetail {
  id: number
  target_role: string
  overall_score: number
  feedback: string
  recommendations: string
  parsed_data: string
  created_at: string
}

function getScoreColor(score: number) {
  if (score < 40) return 'text-red-400'
  if (score < 60) return 'text-orange-400'
  if (score < 80) return 'text-emerald-400'
  return 'text-indigo-400'
}

function safeParseArray(json: string): string[] {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : [] }
  catch { return [] }
}

function safeParseObject(json: string): any {
  try { return JSON.parse(json) ?? {} }
  catch { return {} }
}

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detail, setDetail] = useState<HistoryDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchHistory = async () => {
    try {
      const { data } = await api.get('/history?limit=20')
      setRecords(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDetail = async (id: number) => {
    setDetailLoading(true)
    try {
      const { data } = await api.get(`/history/${id}`)
      setDetail(data)
    } catch (err) {
      console.error(err)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this analysis?')) return
    try {
      await api.delete(`/history/${id}`)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      if (selectedId === id) {
        setSelectedId(null)
        setDetail(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleSelect = (id: number) => {
    if (selectedId === id) {
      setSelectedId(null)
      setDetail(null)
    } else {
      setSelectedId(id)
      fetchDetail(id)
    }
  }

  useEffect(() => { fetchHistory() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-500" size={24} />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8 fade-up">
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Analysis History
        </h1>
        <p className="text-slate-400 mt-1 text-sm">{records.length} analyses saved</p>
      </div>

      {records.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center fade-up">
          <p className="text-slate-400 text-sm">No analyses yet. Go analyze your resume!</p>
        </div>
      ) : (
        <div className="space-y-3 fade-up">
          {records.map((record) => (
            <div key={record.id}>
              <div
                onClick={() => handleSelect(record.id)}
                className={`bg-slate-900 border rounded-2xl p-5 cursor-pointer transition-all ${
                  selectedId === record.id
                    ? 'border-indigo-500/50 bg-slate-800/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span
                      className={`text-2xl font-bold ${getScoreColor(record.overall_score)}`}
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      {record.overall_score}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <Target size={13} className="text-slate-500" />
                        <span className="text-white text-sm font-medium">{record.target_role}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar size={12} className="text-slate-600" />
                        <span className="text-slate-500 text-xs">
                          {new Date(record.created_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(record.id, e)}
                      className="p-2 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight
                      size={16}
                      className={`text-slate-500 transition-transform ${selectedId === record.id ? 'rotate-90' : ''}`}
                    />
                  </div>
                </div>

                <p className="text-slate-400 text-xs mt-3 line-clamp-2 leading-relaxed">
                  {record.feedback}
                </p>
              </div>

              {selectedId === record.id && (
                <div className="mt-2 bg-slate-900/50 border border-slate-800 rounded-b-2xl p-5 -mt-3 pt-6 fade-up">
                  {detailLoading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="animate-spin text-slate-500" size={20} />
                    </div>
                  ) : detail ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Recommendations</p>
                        <div className="space-y-2">
                          {safeParseArray(detail.recommendations).map((rec: string, i: number) => (
                            <div key={i} className="flex gap-2 text-sm text-slate-300">
                              <span className="text-indigo-400 font-bold">{i + 1}.</span>
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs uppercase tracking-wider mb-2">Detected Skills</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(safeParseObject(detail.parsed_data).skills ?? []).map((s: string) => (
                            <span key={s} className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded border border-slate-700">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}