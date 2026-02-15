'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const ROLES = [
  // Sales
  { label: 'AI Solutions Account Executive', category: 'Sales', level: 'mid' },
  { label: 'Sales Development Representative (SDR/BDR)', category: 'Sales', level: 'junior' },
  // Agentic / Full-Stack Engineering
  { label: 'AI Solutions Engineer — Agentic', category: 'Agentic Engineering', level: 'mid' },
  { label: 'AI Research Intern — Agentic Systems', category: 'Agentic Engineering', level: 'junior' },
  { label: 'Full-Stack Engineer', category: 'Full-Stack Engineering', level: 'mid' },
  { label: 'Full-Stack Engineer — Growth Automation', category: 'Full-Stack Engineering', level: 'mid' },
  // Marketing
  { label: 'Growth Marketing Manager — AI Products', category: 'Marketing', level: 'mid' },
  { label: 'Performance Marketing Specialist', category: 'Marketing', level: 'mid' },
  { label: 'Brand Strategist', category: 'Marketing', level: 'senior' },
  { label: 'Campaign Ops Lead', category: 'Marketing', level: 'senior' },
  // Implementation / Customer Outcomes
  { label: 'AI Solutions Consultant (Techno-Functional Pre-Sales)', category: 'Implementation', level: 'mid' },
  { label: 'Client Delivery Lead — AI Enablement', category: 'Implementation', level: 'senior' },
  { label: 'Customer Outcomes Manager — AI Launch', category: 'Implementation', level: 'mid' },
  // Data Steward
  { label: 'Data Steward — Knowledge & Taxonomy', category: 'Data Steward', level: 'mid' },
  { label: 'Data Steward — Retrieval QA', category: 'Data Steward', level: 'mid' },
  // People Ops
  { label: 'People Ops Coordinator', category: 'People Ops', level: 'junior' },
]

export default function TestPage() {
  const [candidateName, setCandidateName] = useState('Test Megha')
  const [role, setRole] = useState(ROLES[0].label)
  const [level, setLevel] = useState(ROLES[0].level)
  const [track, setTrack] = useState('sales')
  const [difficulty, setDifficulty] = useState(3)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const createSession = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate_name: candidateName,
          role,
          level,
          track,
          difficulty
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create session')
      }

      setResult(data)

      // Auto-navigate after 2 seconds
      setTimeout(() => {
        window.location.href = `/candidate/${data.session.id}`
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-2xl font-bold mb-4">Create Test Session</h1>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Candidate Name</label>
            <Input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="Test Megha"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => {
                const selected = ROLES.find(r => r.label === e.target.value)
                setRole(e.target.value)
                if (selected) setLevel(selected.level)
              }}
              className="w-full rounded-2xl border border-ink-100 bg-white px-4 py-2 text-sm text-ink-900 focus:border-skywash-500 focus:outline-none focus:ring-2 focus:ring-skywash-200"
            >
              {Array.from(new Set(ROLES.map(r => r.category))).map(cat => (
                <optgroup key={cat} label={cat}>
                  {ROLES.filter(r => r.category === cat).map(r => (
                    <option key={r.label} value={r.label}>{r.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Level</label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Track (Blueprint)</label>
            <select
              value={track}
              onChange={(e) => setTrack(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
            >
              <option value="sales">Sales</option>
              <option value="agentic_eng">Agentic Engineering</option>
              <option value="fullstack">Fullstack</option>
              <option value="marketing">Marketing</option>
              <option value="implementation">Implementation</option>
              <option value="HR">HR</option>
              <option value="security">Security</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">
              Difficulty Level
              <span className="ml-2 text-xs text-ink-500">
                ({difficulty}/5 - {difficulty === 1 ? '🟢 Easy' : difficulty === 2 ? '🟡 Mild' : difficulty === 3 ? '🟠 Moderate' : difficulty === 4 ? '🔴 Hard' : '⚫ Adversarial'})
              </span>
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="w-full accent-skywash-500"
            />
            <div className="flex justify-between text-xs text-ink-500 mt-1">
              <span>Easy</span>
              <span>Moderate</span>
              <span>Adversarial</span>
            </div>
          </div>

          <Button
            onClick={createSession}
            disabled={loading || !candidateName || !role}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Session'}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm space-y-2">
              <p><strong>✅ Session Created!</strong></p>
              <p className="text-xs">Session ID: <code>{result.session.id}</code></p>
              <p className="text-xs">Redirecting to candidate view...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
