'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ScoreCard } from '@/components/ScoreCard'
import type { ScoreCardProps } from '@/components/ScoreCard'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download, Loader2, Share2 } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

export default function ScoreCardPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scoreCardData, setScoreCardData] = useState<ScoreCardProps | null>(null)

  useEffect(() => {
    async function fetchScoreCardData() {
      try {
        setLoading(true)
        setError(null)

        // Fetch session data
        const { data: session, error: sessionError } = await supabase
          .from('interview_sessions')
          .select(`
            *,
            candidate:candidates(*),
            job:job_profiles(*)
          `)
          .eq('id', sessionId)
          .single()

        if (sessionError) throw sessionError

        // Fetch scope package with rounds
        const { data: scopePackage, error: scopeError } = await supabase
          .from('interview_scope_packages')
          .select('*')
          .eq('session_id', sessionId)
          .single()

        if (scopeError) throw scopeError

        // Fetch scores
        const { data: scores, error: scoresError } = await supabase
          .from('scores')
          .select('*')
          .eq('session_id', sessionId)
          .order('round', { ascending: true })

        if (scoresError) throw scoresError

        // Transform data for ScoreCard component
        const sessionData = {
          sessionId: session.id,
          candidateName: session.candidate?.name || 'Unknown',
          candidateEmail: session.candidate?.email || '',
          jobTitle: session.job?.title || 'Unknown Position',
          track: scopePackage.track || 'general',
          interviewLevel: session.candidate_insights?.interview_level || 'L2',
          sessionStatus: session.status,
          createdAt: session.created_at,
          completedAt: session.updated_at
        }

        // Build round scores
        const roundScores = (scopePackage.round_plan || []).map((round: any) => {
          // Find score for this round
          const roundScore = scores?.find((s: any) =>
            s.round === round.round_number || s.round_number === round.round_number
          )

          // Extract dimension scores
          const dimensionScores = roundScore?.dimension_scores
            ? Object.entries(roundScore.dimension_scores).map(([name, score]) => {
                const rubricDimension = round.config?.scoring_rubric?.dimensions?.find(
                  (d: any) => d.name === name
                )
                return {
                  name,
                  score: Number(score) || 0,
                  maxScore: rubricDimension?.maxScore || 20,
                  description: rubricDimension?.description,
                  evidence: roundScore.evidence_quotes?.filter((e: any) => e.dimension === name) || []
                }
              })
            : []

          return {
            roundNumber: round.round_number,
            roundTitle: round.title,
            roundType: round.round_type,
            status: round.status,
            overallScore: roundScore?.overall_score || 0,
            dimensionScores,
            redFlags: roundScore?.red_flags || [],
            recommendation: roundScore?.recommendation,
            confidence: roundScore?.confidence,
            startedAt: round.started_at,
            completedAt: round.completed_at
          }
        })

        setScoreCardData({
          sessionData,
          roundScores,
          showDetailedEvidence: true
        })
      } catch (err: any) {
        console.error('Error fetching score card data:', err)
        setError(err.message || 'Failed to load score card')
      } finally {
        setLoading(false)
      }
    }

    if (sessionId) {
      void fetchScoreCardData()
    }
  }, [sessionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading score card...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-destructive text-5xl">⚠️</div>
          <h2 className="text-2xl font-bold">Error Loading Score Card</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  if (!scoreCardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">No data available</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <Link href={`/interviewer/${sessionId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Interview
            </Button>
          </Link>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                alert('Score card link copied to clipboard!')
              }}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Score Card */}
        <ScoreCard {...scoreCardData} />
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}
