import React, { useState, useRef } from 'react'
import { FileText, Upload, Loader2, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react'
import api from '../api/client'
import ScoreGauge from '../components/ScoreGauge'

const ROLES = [
  'Software Engineer', 'Data Scientist', 'DevOps Engineer',
  'Product Manager', 'QA Engineer',
]

interface AnalysisResult {
  status: string
  score: number
  parsed_data: {
    email: string
    skills: string[]
    experience_years: number
    education: string
    word_count: number
    sections: Record<string, boolean>
    unvalidated_skills: string[]
    skill_evidence: Record<string, string[]>
  }
  feedback: string
  recommendations: string[]
  match_details: Record<string, {
  matched: string[]
  missing: string[]
  score: number
}>
  score_reasoning: string
}

function formatExperience(years: number): string {
  if (years === 0) return '0 yrs'
  if (years < 1) return `${Math.round(years * 12)} months`
  return `${years} yrs`
}

export default function AnalyzePage() {
  const [tab, setTab] = useState<'text' | 'pdf'>('text')
  const [resumeText, setResumeText] = useState('')
  const [targetRole, setTargetRole] = useState('Software Engineer')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped)
      setError('')
    } else {
      setError('Only PDF files are supported.')
    }
  }

  const handleAnalyze = async () => {
    setError('')
    setLoading(true)
    setResult(null)

    try {
      let data: AnalysisResult

      if (tab === 'text') {
        const res = await api.post('/analyze', {
          resume_text: resumeText,
          target_role: targetRole,
        })
        data = res.data
      } else {
        if (!file) throw new Error('Please select a PDF file')
        const form = new FormData()
        form.append('file', file)
        const res = await api.post(`/analyze-file?target_role=${encodeURIComponent(targetRole)}`, form)
        data = res.data
      }

      setResult(data)
      localStorage.setItem('lastAnalysis', JSON.stringify({
        score: data.score,
        feedback: data.feedback,
        recommendations: data.recommendations,
        target_role: targetRole,
      }))
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8 fade-up">
        <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Resume Analysis
        </h1>
        <p className="text-slate-400 mt-1 text-sm">
          Paste your resume or upload a PDF to get an industry-specific evaluation
        </p>
      </div>

      {/* Input Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 fade-up-delay-1">
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 rounded-xl p-1 w-fit mb-5">
          {(['text', 'pdf'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t === 'text' ? '📝 Paste Text' : '📄 Upload PDF'}
            </button>
          ))}
        </div>

        {/* Role Selector */}
        <div className="mb-4">
          <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">Target Role</label>
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Input */}
        {tab === 'text' ? (
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">Resume Text</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your full resume text here..."
              rows={10}
              className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
            />
          </div>
        ) : (
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wider font-medium">PDF File</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`mt-1.5 border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all group ${
                isDragging
                  ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
                  : file
                  ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-400'
                  : 'border-slate-700 hover:border-indigo-500'
              }`}
            >
              <Upload
                size={28}
                className={`mx-auto mb-3 transition-colors ${
                  isDragging
                    ? 'text-indigo-400'
                    : file
                    ? 'text-emerald-400'
                    : 'text-slate-500 group-hover:text-indigo-400'
                }`}
              />
              {file ? (
                <div>
                  <p className="text-emerald-400 font-medium text-sm">{file.name}</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {(file.size / 1024).toFixed(0)} KB · Click to change
                  </p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                    className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors"
                  >
                    <X size={12} /> Remove file
                  </button>
                </div>
              ) : isDragging ? (
                <div>
                  <p className="text-indigo-400 font-medium text-sm">Drop your PDF here</p>
                  <p className="text-indigo-400/60 text-xs mt-1">Release to upload</p>
                </div>
              ) : (
                <>
                  <p className="text-slate-300 text-sm font-medium">
                    Drop your PDF here, or <span className="text-indigo-400">click to browse</span>
                  </p>
                  <p className="text-slate-500 text-xs mt-1">PDF only · Max 10MB</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) { setFile(selected); setError('') }
              }}
            />
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={loading || (tab === 'text' ? !resumeText.trim() : !file)}
          className="mt-5 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Analyzing your resume...
            </>
          ) : (
            <>
              <FileText size={18} />
              Analyze Resume
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-5 fade-up">

          {/* Score + Feedback */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <ScoreGauge score={result.score} />
              <div className="flex-1">
                <h3 className="text-white font-semibold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
                  Recruiter Verdict
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">{result.feedback}</p>

                {result.score_reasoning && (
                  <p className="text-slate-500 text-xs mt-2 italic">{result.score_reasoning}</p>
                )}

                <div className="flex flex-wrap gap-3 mt-4">
                  {[
                    { label: 'Experience', value: formatExperience(result.parsed_data.experience_years) },
                    { label: 'Education', value: result.parsed_data.education },
                    { label: 'Skills Found', value: result.parsed_data.skills.length },
                    { label: 'Words', value: result.parsed_data.word_count },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-800 rounded-lg px-3 py-2">
                      <p className="text-slate-500 text-xs">{label}</p>
                      <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Unvalidated Skills Warning */}
          {result.parsed_data.unvalidated_skills.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-amber-400" />
                <span className="text-amber-400 font-semibold text-sm">Unvalidated Skills Detected</span>
              </div>
              <p className="text-slate-400 text-xs mb-3">
                These skills are listed but never mentioned in your Experience or Projects section.
                Recruiters may consider them unproven.
              </p>
              <div className="flex flex-wrap gap-2">
                {result.parsed_data.unvalidated_skills.map((skill) => (
                  <span key={skill} className="bg-amber-500/15 text-amber-300 text-xs px-2.5 py-1 rounded-full border border-amber-500/20">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Recommendations
            </h3>
            <div className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="bg-indigo-500/15 text-indigo-400 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {rec}
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Skill Category Breakdown
            </h3>
            <div className="space-y-3">
              {(Object.entries(result.match_details) as [string, { matched: string[], missing: string[], score: number }][]).map(([category, details]) => (
                <div key={category} className="border border-slate-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-200 text-sm font-medium capitalize">
                        {category.replace(/_/g, ' ')}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {details.matched.length}/{details.matched.length + details.missing.length} matched
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${details.score}%`,
                            backgroundColor: details.score >= 70 ? '#34d399' : details.score >= 40 ? '#fbbf24' : '#f87171',
                          }}
                        />
                      </div>
                      <span className="text-xs text-slate-300 w-10 text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        {Math.round(details.score)}%
                      </span>
                      {expandedCategory === category
                        ? <ChevronUp size={14} className="text-slate-500" />
                        : <ChevronDown size={14} className="text-slate-500" />
                      }
                    </div>
                  </button>

                  {expandedCategory === category && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-800">
                      {details.matched.length > 0 && (
                        <div className="pt-3">
                          <p className="text-emerald-400 text-xs font-medium mb-2">✓ Matched</p>
                          <div className="flex flex-wrap gap-1.5">
                            {details.matched.map((s) => (
                              <span key={s} className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/20">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {details.missing.length > 0 && (
                        <div>
                          <p className="text-red-400 text-xs font-medium mb-2">✗ Missing</p>
                          <div className="flex flex-wrap gap-1.5">
                            {details.missing.map((s) => (
                              <span key={s} className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded border border-red-500/20">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detected Sections */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-white font-semibold mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Resume Sections Detected
            </h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.parsed_data.sections).map(([section, found]) => (
                <span
                  key={section}
                  className={`text-xs px-3 py-1.5 rounded-full border capitalize ${
                    found
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}
                >
                  {found ? '✓' : '✗'} {section}
                </span>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}