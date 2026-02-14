'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

export default function TestPage() {
  const [track, setTrack] = useState('sales')
  const [candidateName, setCandidateName] = useState('Jane Doe')
  const [role, setRole] = useState('Account Executive')
  const [level, setLevel] = useState('mid')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTrackChange = (newTrack: string) => {
    setTrack(newTrack)
    if (newTrack === 'implementation') {
      setRole('Implementation Manager')
    } else {
      setRole('Account Executive')
    }
  }

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
          track
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
          <h1 className="text-2xl font-bold">Create Test Session</h1>
          <p className="text-sm text-ink-500">Quick session creation for testing</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium block mb-1">Track</label>
            <Select
              value={track}
              onChange={(e) => handleTrackChange(e.target.value)}
            >
              <option value="sales">Sales (BDR/AE)</option>
              <option value="implementation">Implementation / Customer Outcomes</option>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Candidate Name</label>
            <Input
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Role</label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Account Executive"
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Level</label>
            <Select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="junior">Junior</option>
              <option value="mid">Mid</option>
              <option value="senior">Senior</option>
            </Select>
          </div>

          <Button
            onClick={createSession}
            disabled={loading || !candidateName || !role}
            className="w-full"
          >
            {loading ? 'Creating...' : 'Create Session'}
          </Button>

          {error && (
            <div className="rounded-2xl border border-signal-200 bg-signal-100 px-4 py-3 text-sm text-signal-800">
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && (
            <div className="rounded-2xl border border-skywash-200 bg-skywash-50 px-4 py-3 text-sm text-skywash-800 space-y-1">
              <p className="font-semibold">Session Created</p>
              <p className="text-xs text-skywash-700">Session ID: <code className="bg-skywash-100 px-1.5 py-0.5 rounded">{result.session.id}</code></p>
              <p className="text-xs text-skywash-700">Redirecting to candidate view...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
