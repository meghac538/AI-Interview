'use client'

import React from 'react'

interface SayMeterProps {
  score: number
  factors: {
    rapport: number
    discovery: number
    objection_handling: number
    value_articulation: number
    closing_momentum: number
  }
  summary?: string
  loading?: boolean
}

export function SayMeter({ score, factors, summary, loading }: SayMeterProps) {
  // Get color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 81) return 'text-green-500'
    if (score >= 61) return 'text-yellow-500'
    if (score >= 41) return 'text-orange-500'
    return 'text-red-500'
  }

  const getScoreBgColor = (score: number): string => {
    if (score >= 81) return 'bg-green-100'
    if (score >= 61) return 'bg-yellow-100'
    if (score >= 41) return 'bg-orange-100'
    return 'bg-red-100'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 81) return '🎯 Excellent'
    if (score >= 61) return '✅ Good'
    if (score >= 41) return '⚠️ Getting There'
    return '❌ Needs Improvement'
  }

  // Factor labels for display
  const factorLabels: Record<keyof typeof factors, string> = {
    rapport: 'Rapport',
    discovery: 'Discovery',
    objection_handling: 'Objection Handling',
    value_articulation: 'Value Articulation',
    closing_momentum: 'Closing Momentum'
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 rounded-full bg-gray-200"></div>
          </div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!score && score !== 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg font-medium">No Say Meter data yet</p>
          <p className="text-sm mt-2">Scores will appear after 10 messages</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      {/* Header */}
      <h3 className="text-lg font-semibold mb-4">Say Meter</h3>

      {/* Circular Score Gauge */}
      <div className="flex justify-center mb-6">
        <div className={`relative w-32 h-32 rounded-full ${getScoreBgColor(score)} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-4xl font-bold ${getScoreColor(score)}`}>{score}</div>
            <div className="text-xs text-gray-600 mt-1">{getScoreLabel(score)}</div>
          </div>
        </div>
      </div>

      {/* Factor Breakdown */}
      <div className="space-y-3">
        {(Object.keys(factors) as Array<keyof typeof factors>).map((key) => (
          <div key={key} className="flex items-center gap-3">
            <div className="min-w-[140px] text-sm font-medium text-gray-700">
              {factorLabels[key]}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getScoreColor(factors[key]).replace('text-', 'bg-')}`}
                  style={{ width: `${factors[key]}%` }}
                ></div>
              </div>
              <div className={`text-sm font-semibold ${getScoreColor(factors[key])} min-w-[32px] text-right`}>
                {factors[key]}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      {summary && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm text-gray-600 italic">{summary}</p>
        </div>
      )}
    </div>
  )
}
