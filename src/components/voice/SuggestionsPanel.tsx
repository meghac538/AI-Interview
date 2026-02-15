'use client'

import React, { useState } from 'react'
import type { Suggestion } from './types'

interface SuggestionsPanelProps {
  suggestions: Suggestion[]
  loading?: boolean
  onDismiss: (id: string) => Promise<void>
  onApply?: (suggestion: Suggestion) => void
}

export function SuggestionsPanel({ suggestions, loading, onDismiss, onApply }: SuggestionsPanelProps) {
  const [dismissing, setDismissing] = useState<string | null>(null)

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500'
      case 'high':
        return 'bg-orange-500'
      case 'medium':
        return 'bg-yellow-500'
      case 'low':
        return 'bg-gray-400'
      default:
        return 'bg-gray-400'
    }
  }

  const getCategoryBadge = (category: string): { label: string; color: string } => {
    switch (category) {
      case 'context_injection':
        return { label: 'Context', color: 'bg-blue-100 text-blue-700' }
      case 'curveball':
        return { label: 'Curveball', color: 'bg-purple-100 text-purple-700' }
      case 'followup_question':
        return { label: 'Follow-up', color: 'bg-green-100 text-green-700' }
      default:
        return { label: category, color: 'bg-gray-100 text-gray-700' }
    }
  }

  const handleDismiss = async (id: string) => {
    setDismissing(id)
    try {
      await onDismiss(id)
    } catch (error) {
      console.error('Failed to dismiss suggestion:', error)
    } finally {
      setDismissing(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">AI Suggestions</h3>
        <div className="space-y-3 animate-pulse">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">AI Suggestions</h3>
        <div className="text-center text-gray-500 py-8">
          <p className="text-lg font-medium">No suggestions yet</p>
          <p className="text-sm mt-2">AI will provide coaching tips as the conversation progresses</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">AI Suggestions</h3>
        <span className="text-sm text-gray-500">{suggestions.length} active</span>
      </div>

      <div className="space-y-3">
        {suggestions.map((suggestion) => {
          const categoryBadge = getCategoryBadge(suggestion.category)
          const isBeingDismissed = dismissing === suggestion.id

          return (
            <div
              key={suggestion.id}
              className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-2">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${getPriorityColor(suggestion.priority)}`}></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${categoryBadge.color}`}>
                      {categoryBadge.label}
                    </span>
                    <span className="text-xs text-gray-500 capitalize">{suggestion.priority} priority</span>
                  </div>
                  <p className="text-sm text-gray-700">{suggestion.text}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3">
                {onApply && (
                  <button
                    onClick={() => onApply(suggestion)}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Apply
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(suggestion.id)}
                  disabled={isBeingDismissed}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {isBeingDismissed ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
