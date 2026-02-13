'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function TestPage() {
  const [candidateName, setCandidateName] = useState('Jane Doe')
  const [role, setRole] = useState('Account Executive')
  const [level, setLevel] = useState('mid')
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
          level
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
