"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

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

const TRACKS = [
  { value: 'sales', label: 'Sales' },
  { value: 'agentic_eng', label: 'Agentic Engineering' },
  { value: 'fullstack', label: 'Fullstack' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'implementation', label: 'Implementation' },
  { value: 'HR', label: 'HR' },
  { value: 'security', label: 'Security' },
]

export default function TestPage() {
  const router = useRouter()
  const [candidateName, setCandidateName] = useState("Test Megha")
  const [role, setRole] = useState(ROLES[0].label)
  const [level, setLevel] = useState(ROLES[0].level)
  const [track, setTrack] = useState('sales')
  const [difficulty, setDifficulty] = useState(3)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createSession = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        throw new Error(data.error || "Failed to create session")
      }

      router.push(`/candidate/${data.session.id}`)
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const difficultyLabel =
    difficulty === 1 ? 'Easy' :
    difficulty === 2 ? 'Mild' :
    difficulty === 3 ? 'Moderate' :
    difficulty === 4 ? 'Hard' : 'Adversarial'

  const categories = Array.from(new Set(ROLES.map(r => r.category)))

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Test Session</CardTitle>
            <CardDescription>
              Internal launcher for local testing. On success, candidate route opens immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="candidateName">Candidate Name</Label>
              <Input id="candidateName" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  setRole(value)
                  const selected = ROLES.find(r => r.label === value)
                  if (selected) setLevel(selected.level)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectGroup key={cat}>
                      <SelectLabel>{cat}</SelectLabel>
                      {ROLES.filter(r => r.category === cat).map(r => (
                        <SelectItem key={r.label} value={r.label}>{r.label}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Track (Blueprint)</Label>
              <Select value={track} onValueChange={setTrack}>
                <SelectTrigger>
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {TRACKS.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>
                Difficulty Level
                <span className="ml-2 text-xs text-muted-foreground">
                  ({difficulty}/5 — {difficultyLabel})
                </span>
              </Label>
              <input
                type="range"
                min={1}
                max={5}
                value={difficulty}
                onChange={(e) => setDifficulty(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Easy</span>
                <span>Moderate</span>
                <span>Adversarial</span>
              </div>
            </div>

            <Button onClick={createSession} disabled={loading || !candidateName || !role} className="w-full">
              {loading ? <Loader2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? "Creating session..." : "Create & Open Candidate View"}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertTitle>Session creation failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
