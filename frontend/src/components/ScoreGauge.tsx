interface ScoreGaugeProps {
  score: number
}

function getScoreColor(score: number) {
  if (score < 40) return '#f87171'
  if (score < 60) return '#fb923c'
  if (score < 80) return '#34d399'
  return '#818cf8'
}

function getScoreLabel(score: number) {
  if (score < 40) return '🔴 Not Ready'
  if (score < 60) return '🟡 Needs Improvement'
  if (score < 80) return '🟢 Competitive'
  return '🔥 Strong Candidate'
}

export default function ScoreGauge({ score }: ScoreGaugeProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const radius = 54
  const circumference = Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="140" height="80" viewBox="0 0 140 80">
          <path
            d="M 10 75 A 60 60 0 0 1 130 75"
            fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round"
          />
          <path
            d="M 10 75 A 60 60 0 0 1 130 75"
            fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-3xl font-bold" style={{ color, fontFamily: 'var(--font-mono)' }}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-slate-300">{label}</span>
    </div>
  )
}