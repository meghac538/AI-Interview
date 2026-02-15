'use client'

import { useState } from 'react'
import { useVoiceRealtime } from '@/hooks/useVoiceRealtime'
import { useVoiceAnalysis } from '@/hooks/useVoiceAnalysis'
import { SayMeter } from '@/components/voice/SayMeter'
import { SuggestionsPanel } from '@/components/voice/SuggestionsPanel'

export default function TestVoicePage() {
  const [sessionId, setSessionId] = useState('test-voice-001')
  const [personaId, setPersonaId] = useState('')
  const [started, setStarted] = useState(false)

  // Voice connection
  const voice = useVoiceRealtime({
    sessionId: started ? sessionId : '',
    personaId: started ? personaId : undefined,
    difficulty: 3
  })

  // Analytics
  const analytics = useVoiceAnalysis({
    sessionId: started ? sessionId : '',
    enabled: started && voice.isConnected
  })

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Voice Analytics Test Page</h1>

        {/* Setup Form */}
        {!started && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Setup</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Session ID
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="test-voice-001"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must exist in interview_sessions table
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Persona ID (optional)
                </label>
                <input
                  type="text"
                  value={personaId}
                  onChange={(e) => setPersonaId(e.target.value)}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="Leave empty to use session's selected persona"
                />
              </div>

              <button
                onClick={() => setStarted(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Start Test
              </button>
            </div>
          </div>
        )}

        {/* Main Test Area */}
        {started && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Voice Control */}
            <div className="lg:col-span-2 space-y-6">
              {/* Connection Status */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Voice Connection</h2>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${voice.isConnected ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="font-medium">
                      {voice.isConnecting ? 'Connecting...' : voice.isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>

                  {!voice.isConnected && !voice.isConnecting && (
                    <button
                      onClick={voice.connect}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      🎤 Start Voice Call
                    </button>
                  )}

                  {voice.isConnected && (
                    <button
                      onClick={voice.disconnect}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      ⏹ End Call
                    </button>
                  )}

                  {voice.error && (
                    <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                      <strong>Error:</strong> {voice.error}
                    </div>
                  )}
                </div>
              </div>

              {/* Transcript */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Live Transcript ({voice.transcript.length} messages)
                </h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {voice.transcript.length === 0 && (
                    <p className="text-gray-500 italic">
                      Start the call to see transcript...
                    </p>
                  )}
                  {voice.transcript.map((item, i) => (
                    <div key={i} className="p-2 rounded bg-gray-50">
                      <span className={`font-semibold ${item.role === 'user' ? 'text-blue-600' : 'text-purple-600'}`}>
                        {item.role === 'user' ? '👤 Candidate' : '🤖 AI Prospect'}:
                      </span>{' '}
                      <span className="text-gray-700">{item.text}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>

                {voice.transcript.length >= 10 && (
                  <div className="mt-4 p-3 bg-green-50 text-green-700 rounded text-sm">
                    ✅ {Math.floor(voice.transcript.length / 10)} analysis trigger(s) should have fired!
                  </div>
                )}
              </div>

              {/* Debug Info */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Debug Info</h2>
                <div className="space-y-2 text-sm font-mono">
                  <div>Session: <code className="bg-gray-100 px-2 py-1 rounded">{sessionId}</code></div>
                  <div>Connected: <code className="bg-gray-100 px-2 py-1 rounded">{voice.isConnected ? 'Yes' : 'No'}</code></div>
                  <div>Messages: <code className="bg-gray-100 px-2 py-1 rounded">{voice.transcript.length}</code></div>
                  <div>Analytics Loading: <code className="bg-gray-100 px-2 py-1 rounded">{analytics.loading ? 'Yes' : 'No'}</code></div>
                  <div>Say Meter: <code className="bg-gray-100 px-2 py-1 rounded">{analytics.sayMeter ? `Score: ${analytics.sayMeter.score}` : 'None yet'}</code></div>
                  <div>Suggestions: <code className="bg-gray-100 px-2 py-1 rounded">{analytics.suggestions.length} active</code></div>
                </div>
              </div>
            </div>

            {/* Analytics Panels */}
            <div className="space-y-6">
              {/* Say Meter */}
              {analytics.sayMeter ? (
                <SayMeter
                  score={analytics.sayMeter.score}
                  factors={analytics.sayMeter.factors}
                  summary={analytics.sayMeter.meter_reasoning}
                  loading={analytics.loading}
                />
              ) : (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold mb-4">Say Meter</h3>
                  <div className="text-center text-gray-500 py-8">
                    <p className="text-lg font-medium">Waiting for data...</p>
                    <p className="text-sm mt-2">Analysis triggers after 10 messages</p>
                  </div>
                </div>
              )}

              {/* Suggestions */}
              <SuggestionsPanel
                suggestions={analytics.suggestions}
                loading={analytics.loading}
                onDismiss={async (id) => {
                  await analytics.dismissSuggestion(id)
                  console.log('Dismissed suggestion:', id)
                }}
                onApply={(suggestion) => {
                  console.log('Applied suggestion:', suggestion)
                  alert(`Applied: ${suggestion.text}`)
                }}
              />

              {analytics.error && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="p-3 bg-red-50 text-red-700 rounded text-sm">
                    <strong>Analytics Error:</strong> {analytics.error}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
