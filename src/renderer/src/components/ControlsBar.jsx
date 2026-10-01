import React from 'react'

export default function ControlsBar({ running, onStart, onStop, mediaStream }) {
  return (
    <div className="controls-bar">
      <button
        className="btn btn-primary"
        onClick={onStart}
        disabled={running || !mediaStream}
        style={{ minWidth: '160px' }}
      >
        {running ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
            Running
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Start Camera
          </>
        )}
      </button>

      <button
        className="btn btn-danger"
        onClick={onStop}
        disabled={!running}
        style={{ minWidth: '140px' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        Stop
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
        <span>
          {mediaStream ? (
            <>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginRight: '6px' }} />
              Camera Ready
            </>
          ) : (
            <>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', marginRight: '6px' }} />
              No Camera
            </>
          )}
        </span>
      </div>
    </div>
  )
}