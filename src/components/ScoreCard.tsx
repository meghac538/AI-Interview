'use client'

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus, Clock, Award, FileText, XCircle, Zap } from "lucide-react"
import { format } from "date-fns"

interface DimensionScore {
  name: string
  score: number
  maxScore: number
  description?: string
  evidence?: Array<{ quote: string }>
}

interface CurveballEntry {
  key?: string
  title: string
  detail: string
  injected_at?: string
}

interface RoundScore {
  roundNumber: number
  roundTitle: string
  roundType: string
  status: 'completed' | 'active' | 'pending' | 'skipped'
  overallScore: number
  dimensionScores: DimensionScore[]
  redFlags: Array<{
    flag_type: string
    severity: 'warning' | 'critical'
    description: string
  }>
  recommendation?: 'proceed' | 'caution' | 'stop'
  confidence?: number
  startedAt?: string
  completedAt?: string
  curveballs?: CurveballEntry[]
}

interface SessionData {
  sessionId: string
  candidateName: string
  candidateEmail: string
  jobTitle: string
  track: string
  interviewLevel: string
  sessionStatus: 'completed' | 'live' | 'scheduled'
  createdAt: string
  completedAt?: string
}

export interface ScoreCardProps {
  sessionData: SessionData
  roundScores: RoundScore[]
  showDetailedEvidence?: boolean
  compact?: boolean
}

export function ScoreCard({
  sessionData,
  roundScores,
  showDetailedEvidence = false,
  compact = false
}: ScoreCardProps) {
  // Calculate session-level metrics
  const completedRounds = roundScores.filter(r => r.status === 'completed')
  const avgOverallScore = completedRounds.length > 0
    ? Math.round(completedRounds.reduce((sum, r) => sum + r.overallScore, 0) / completedRounds.length)
    : 0

  const sessionRecommendation = (() => {
    if (completedRounds.length === 0) return 'pending'
    const stopCount = completedRounds.filter(r => r.recommendation === 'stop').length
    const proceedCount = completedRounds.filter(r => r.recommendation === 'proceed').length

    if (stopCount > completedRounds.length / 2) return 'stop'
    if (proceedCount >= completedRounds.length / 2 && avgOverallScore >= 70) return 'proceed'
    return 'caution'
  })()

  const totalRedFlags = roundScores.reduce((sum, r) => sum + r.redFlags.length, 0)
  const criticalFlags = roundScores.reduce((sum, r) =>
    sum + r.redFlags.filter(f => f.severity === 'critical').length, 0
  )

  return (
    <div className="space-y-6">
      {/* Session Summary Header */}
      <Card className={compact ? '' : 'border-2'}>
        <CardHeader className={compact ? 'pb-3' : ''}>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 flex-1">
              <CardTitle className={compact ? 'text-lg' : 'text-2xl'}>
                Interview Score Card
              </CardTitle>
              <CardDescription>
                {sessionData.candidateName} • {sessionData.jobTitle}
              </CardDescription>
            </div>
            <Badge
              variant={
                sessionRecommendation === 'proceed' ? 'default' :
                sessionRecommendation === 'caution' ? 'secondary' :
                'destructive'
              }
              className="text-sm px-3 py-1"
            >
              {sessionRecommendation === 'pending' ? 'In Progress' : sessionRecommendation.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Award className="h-3 w-3" />
                Overall Score
              </div>
              <div className="text-2xl font-bold">{avgOverallScore}</div>
              <Progress value={avgOverallScore} className="mt-2 h-1.5" />
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText className="h-3 w-3" />
                Rounds Completed
              </div>
              <div className="text-2xl font-bold">
                {completedRounds.length}/{roundScores.length}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="h-3 w-3" />
                Red Flags
              </div>
              <div className="text-2xl font-bold">
                {totalRedFlags}
                {criticalFlags > 0 && (
                  <span className="text-sm text-destructive ml-1">({criticalFlags} critical)</span>
                )}
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock className="h-3 w-3" />
                Track / Level
              </div>
              <div className="text-lg font-semibold">
                {sessionData.track} / {sessionData.interviewLevel}
              </div>
            </div>
          </div>

          {/* Session Metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2 border-t">
            <div>
              <span className="font-medium">Email:</span> {sessionData.candidateEmail}
            </div>
            <div>
              <span className="font-medium">Started:</span>{' '}
              {format(new Date(sessionData.createdAt), 'MMM d, yyyy h:mm a')}
            </div>
            {sessionData.completedAt && (
              <div>
                <span className="font-medium">Completed:</span>{' '}
                {format(new Date(sessionData.completedAt), 'MMM d, yyyy h:mm a')}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Round-by-Round Breakdown */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Round Performance</h3>
        {roundScores.map((round) => (
          <RoundScoreCard
            key={round.roundNumber}
            round={round}
            showDetailedEvidence={showDetailedEvidence}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}

function RoundScoreCard({
  round,
  showDetailedEvidence,
  compact
}: {
  round: RoundScore
  showDetailedEvidence: boolean
  compact: boolean
}) {
  const getRecommendationIcon = (rec?: string) => {
    if (rec === 'proceed') return <TrendingUp className="h-4 w-4 text-emerald-600" />
    if (rec === 'caution') return <Minus className="h-4 w-4 text-amber-600" />
    if (rec === 'stop') return <TrendingDown className="h-4 w-4 text-destructive" />
    return <Clock className="h-4 w-4 text-muted-foreground" />
  }

  const getStatusBadge = (status: string) => {
    if (status === 'completed') return <CheckCircle2 className="h-3 w-3 text-emerald-600" />
    if (status === 'active') return <Clock className="h-3 w-3 text-blue-600" />
    if (status === 'skipped') return <XCircle className="h-3 w-3 text-muted-foreground" />
    return <Clock className="h-3 w-3 text-muted-foreground" />
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getStatusBadge(round.status)}
              <CardTitle className="text-base">
                {round.roundTitle}
              </CardTitle>
            </div>
            <CardDescription className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">
                {round.roundType}
              </Badge>
              {round.startedAt && round.completedAt && (
                <span>
                  Duration: {Math.round(
                    (new Date(round.completedAt).getTime() - new Date(round.startedAt).getTime()) / 60000
                  )}min
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {round.confidence !== undefined && round.status === 'completed' && (
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="text-sm font-semibold">{Math.round(round.confidence * 100)}%</div>
              </div>
            )}
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Score</div>
              <div className="text-2xl font-bold">{round.overallScore}</div>
            </div>
            {round.recommendation && (
              <div className="flex flex-col items-center gap-1">
                {getRecommendationIcon(round.recommendation)}
                <span className="text-[10px] uppercase font-semibold">
                  {round.recommendation}
                </span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dimension Scores */}
        {round.dimensionScores.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Dimension Breakdown
            </p>
            {round.dimensionScores.filter(d => !(d.name === 'adaptability' && round.curveballs && round.curveballs.length > 0)).map((dimension) => {
              const percentage = (dimension.score / dimension.maxScore) * 100
              return (
                <div key={dimension.name} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {dimension.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {dimension.score}/{dimension.maxScore}
                    </span>
                  </div>
                  <Progress value={percentage} />
                  {dimension.description && (
                    <p className="text-xs text-muted-foreground">{dimension.description}</p>
                  )}
                  {showDetailedEvidence && dimension.evidence && dimension.evidence.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {dimension.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="rounded bg-muted/50 px-2 py-1.5 text-xs italic border-l-2 border-primary/40"
                        >
                          &ldquo;{ev.quote}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground italic text-center py-4 border rounded-lg bg-muted/20">
            {round.status === 'completed' ? 'No dimension scores recorded' : 'Scoring pending'}
          </div>
        )}

        {/* Curveball Handling */}
        {round.curveballs && round.curveballs.length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Curveball Handling
              </p>
            </div>

            {/* Adaptability score if present */}
            {(() => {
              const adaptability = round.dimensionScores.find(d => d.name === 'adaptability')
              if (!adaptability) return null
              const pct = (adaptability.score / adaptability.maxScore) * 100
              return (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Zap className="h-3 w-3 text-amber-500" />
                      Adaptability Score
                    </span>
                    <span className="text-sm font-bold tabular-nums">
                      {adaptability.score}/{adaptability.maxScore}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  {adaptability.description && (
                    <p className="text-xs text-muted-foreground">{adaptability.description}</p>
                  )}
                  {showDetailedEvidence && adaptability.evidence && adaptability.evidence.length > 0 && (
                    <div className="space-y-1 mt-1">
                      {adaptability.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="rounded bg-amber-500/10 px-2 py-1.5 text-xs italic border-l-2 border-amber-500/40"
                        >
                          &ldquo;{ev.quote}&rdquo;
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Curveball list */}
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Constraints injected during this round:</p>
              {round.curveballs.map((cb, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-xs">
                  <Zap className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">{cb.title}</span>
                    {cb.detail && <span className="text-muted-foreground"> — {cb.detail}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Red Flags */}
        {round.redFlags.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Red Flags ({round.redFlags.length})
            </p>
            {round.redFlags.map((flag, idx) => (
              <div
                key={idx}
                className={`rounded-lg border p-2 text-sm ${
                  flag.severity === 'critical'
                    ? 'border-destructive/50 bg-destructive/10'
                    : 'border-amber-500/50 bg-amber-500/10'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="capitalize">
                    {flag.flag_type.replace(/_/g, ' ')}
                  </span>
                  <Badge
                    variant={flag.severity === 'critical' ? 'destructive' : 'secondary'}
                    className="text-[9px] ml-auto"
                  >
                    {flag.severity}
                  </Badge>
                </div>
                {flag.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{flag.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
