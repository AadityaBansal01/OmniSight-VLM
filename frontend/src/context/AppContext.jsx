import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import apiClient from '../api/client';

const AppContext = createContext(null);

const initialState = {
  pipeline: {
    is_running: false,
    video_id: null,
    video_filename: null,
    stage: 'idle',
    progress: 0,
    message: 'Idle',
    events_found: 0,
  },
  activeVideoId: null,
  refreshTrigger: 0,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PIPELINE':
      return { ...state, pipeline: { ...state.pipeline, ...action.payload } };
    case 'SET_ACTIVE_VIDEO':
      return { ...state, activeVideoId: action.payload };
    case 'TRIGGER_REFRESH':
      return { ...state, refreshTrigger: state.refreshTrigger + 1 };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWebSocket = useCallback(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/api/v1/pipeline/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected to pipeline WebSocket');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          dispatch({ type: 'SET_PIPELINE', payload: data });

          if (data.stage === 'complete' || data.stage === 'error') {
            dispatch({ type: 'TRIGGER_REFRESH' });
          }
        } catch (e) {
          console.warn('[WS] Failed to parse message:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected. Reconnecting in 3s...');
        reconnectTimer.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      reconnectTimer.current = setTimeout(connectWebSocket, 5000);
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connectWebSocket]);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await apiClient.get('/api/v1/pipeline/status');
        dispatch({ type: 'SET_PIPELINE', payload: res.data });
      } catch {
        // Backend might not be ready yet
      }
    }, 5000);
    return () => clearInterval(poll);
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  
  return {
    state: ctx.state,
    dispatch: ctx.dispatch,
    isPipelineRunning: ctx.state.pipeline.is_running,
    pipelineStatus: ctx.state.pipeline,
    refreshTrigger: ctx.state.refreshTrigger,
  };
}
