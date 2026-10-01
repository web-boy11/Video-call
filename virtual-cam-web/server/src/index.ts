import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { v4 as uuidv4 } from 'uuid'

interface Agent {
  id: string
  socketId: string
  name: string
  status: 'connected' | 'disconnected'
  capabilities: string[]
  lastSeen: number
}

interface Client {
  id: string
  socketId: string
  pairedAgentId: string | null
}

// WebRTC room state
interface WebRTCRoom {
  id: string
  broadcasterId: string | null
  viewers: Set<string>
  createdAt: number
}

const app = express()

// CORS configuration for production
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000']
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}))
app.use(express.json())

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
})

// State
const agents = new Map<string, Agent>()
const clients = new Map<string, Client>()
const agentToClient = new Map<string, string>() // agentId -> clientId
const webrtcRooms = new Map<string, WebRTCRoom>()

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    agents: agents.size,
    clients: clients.size,
    webrtcRooms: webrtcRooms.size,
    uptime: process.uptime()
  })
})

// List available agents
app.get('/api/agents', (req, res) => {
  res.json(Array.from(agents.values()).map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    capabilities: a.capabilities,
    lastSeen: a.lastSeen
  })))
})

// WebRTC room info endpoint
app.get('/api/webrtc/rooms/:roomId', (req, res) => {
  const room = webrtcRooms.get(req.params.roomId)
  if (!room) {
    return res.status(404).json({ error: 'Room not found' })
  }
  res.json({
    id: room.id,
    broadcasterConnected: !!room.broadcasterId,
    viewerCount: room.viewers.size,
    createdAt: room.createdAt
  })
})

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`)

  // Agent registration (Desktop Agent mode)
  socket.on('agent:register', (data: { name: string; capabilities: string[] }) => {
    const agentId = uuidv4()
    const agent: Agent = {
      id: agentId,
      socketId: socket.id,
      name: data.name || `Agent-${agentId.slice(0, 8)}`,
      status: 'connected',
      capabilities: data.capabilities || ['obs', 'camera', 'voice', 'background'],
      lastSeen: Date.now()
    }
    agents.set(agentId, agent)
    socket.join(`agent:${agentId}`)

    // If there's a waiting client, pair them
    const waitingClientId = Array.from(clients.entries()).find(
      ([, c]) => c.pairedAgentId === null
    )?.[0]

    if (waitingClientId) {
      const client = clients.get(waitingClientId)!
      client.pairedAgentId = agentId
      agentToClient.set(agentId, waitingClientId)
      socket.to(`client:${waitingClientId}`).emit('client:paired', { agentId, agentName: agent.name })
      socket.emit('agent:paired', { clientId: waitingClientId })
    }

    socket.emit('agent:registered', { agentId, agent })
    broadcastAgentList()
    console.log(`Agent registered: ${agentId} (${agent.name})`)
  })

  // Client registration (Desktop Agent mode)
  socket.on('client:register', (data: { preferredAgentId?: string }) => {
    const clientId = uuidv4()
    const client: Client = {
      id: clientId,
      socketId: socket.id,
      pairedAgentId: null
    }
    clients.set(clientId, client)
    socket.join(`client:${clientId}`)

    // Try to pair with preferred or any available agent
    let targetAgentId = data.preferredAgentId
    if (!targetAgentId || !agents.has(targetAgentId)) {
      targetAgentId = Array.from(agents.entries()).find(([id, a]) => a.status === 'connected')?.[0]
    }

    if (targetAgentId) {
      const agent = agents.get(targetAgentId)!
      client.pairedAgentId = targetAgentId
      agentToClient.set(targetAgentId, clientId)
      socket.emit('client:paired', { agentId: targetAgentId, agentName: agent.name })
      io.to(`agent:${targetAgentId}`).emit('agent:paired', { clientId })
    }

    socket.emit('client:registered', { clientId, agents: Array.from(agents.values()) })
    console.log(`Client registered: ${clientId}`)
  })

  // Command from client to agent (Desktop Agent mode)
  socket.on('client:command', (data: { agentId: string; command: string; payload: any }) => {
    const clientId = Array.from(clients.entries()).find(([, c]) => c.socketId === socket.id)?.[0]
    const client = clients.get(clientId!)

    if (!client || client.pairedAgentId !== data.agentId) {
      socket.emit('error', { message: 'Not paired with this agent' })
      return
    }

    const agent = agents.get(data.agentId)
    if (!agent || agent.status !== 'connected') {
      socket.emit('error', { message: 'Agent not connected' })
      return
    }

    io.to(`agent:${data.agentId}`).emit('agent:command', {
      commandId: uuidv4(),
      command: data.command,
      payload: data.payload
    })
  })

  // Response from agent to client
  socket.on('agent:response', (data: { clientId: string; commandId: string; success: boolean; result?: any; error?: string }) => {
    io.to(`client:${data.clientId}`).emit('client:response', data)
  })

  // Status updates from agent
  socket.on('agent:status', (data: { agentId: string; status: Partial<Agent> }) => {
    const agent = agents.get(data.agentId)
    if (agent) {
      Object.assign(agent, data.status, { lastSeen: Date.now() })
      broadcastAgentList()
      const clientId = agentToClient.get(data.agentId)
      if (clientId) {
        io.to(`client:${clientId}`).emit('agent:status', { agentId: data.agentId, status: data.status })
      }
    }
  })

  // Heartbeat
  socket.on('agent:heartbeat', (data: { agentId: string }) => {
    const agent = agents.get(data.agentId)
    if (agent) {
      agent.lastSeen = Date.now()
      agent.status = 'connected'
    }
  })

  // ============ WebRTC Signaling (Browser Mode) ============

  // Join WebRTC room
  socket.on('webrtc:join', (data: { roomId: string; role: 'broadcaster' | 'viewer' }) => {
    const { roomId, role } = data

    let room = webrtcRooms.get(roomId)
    if (!room) {
      room = {
        id: roomId,
        broadcasterId: null,
        viewers: new Set(),
        createdAt: Date.now()
      }
      webrtcRooms.set(roomId, room)
    }

    socket.join(`webrtc:${roomId}`)

    if (role === 'broadcaster') {
      if (room.broadcasterId) {
        // Another broadcaster already exists
        socket.emit('webrtc:error', { message: 'Room already has a broadcaster' })
        return
      }
      room.broadcasterId = socket.id
      console.log(`Broadcaster joined room ${roomId}: ${socket.id}`)
    } else {
      room.viewers.add(socket.id)
      console.log(`Viewer joined room ${roomId}: ${socket.id} (total viewers: ${room.viewers.size})`)
    }

    // Notify others
    socket.to(`webrtc:${roomId}`).emit('webrtc:peer-joined', { socketId: socket.id, role })
  })

  // WebRTC Offer
  socket.on('webrtc:offer', (data: { roomId: string; offer: RTCSessionDescriptionInit }) => {
    const room = webrtcRooms.get(data.roomId)
    if (!room) return

    // Forward offer to all viewers
    socket.to(`webrtc:${data.roomId}`).emit('webrtc:offer', {
      offer: data.offer,
      from: socket.id
    })
  })

  // WebRTC Answer
  socket.on('webrtc:answer', (data: { roomId: string; answer: RTCSessionDescriptionInit }) => {
    const room = webrtcRooms.get(data.roomId)
    if (!room || !room.broadcasterId) return

    // Forward answer to broadcaster
    io.to(room.broadcasterId).emit('webrtc:answer', {
      answer: data.answer,
      from: socket.id
    })
  })

  // ICE Candidate
  socket.on('webrtc:ice-candidate', (data: { roomId: string; candidate: RTCIceCandidateInit }) => {
    const room = webrtcRooms.get(data.roomId)
    if (!room) return

    // Forward to appropriate peer
    if (socket.id === room.broadcasterId) {
      // Broadcaster sending to all viewers
      room.viewers.forEach(viewerId => {
        io.to(viewerId).emit('webrtc:ice-candidate', {
          candidate: data.candidate,
          from: socket.id
        })
      })
    } else if (room.viewers.has(socket.id)) {
      // Viewer sending to broadcaster
      if (room.broadcasterId) {
        io.to(room.broadcasterId).emit('webrtc:ice-candidate', {
          candidate: data.candidate,
          from: socket.id
        })
      }
    }
  })

  // Disconnect
  socket.on('disconnect', () => {
    // Handle agent disconnect
    for (const [agentId, agent] of agents.entries()) {
      if (agent.socketId === socket.id) {
        agents.delete(agentId)
        const clientId = agentToClient.get(agentId)
        if (clientId) {
          const client = clients.get(clientId)
          if (client) client.pairedAgentId = null
          agentToClient.delete(agentId)
          io.to(`client:${clientId}`).emit('client:unpaired', { agentId })
        }
        broadcastAgentList()
        console.log(`Agent disconnected: ${agentId}`)
        break
      }
    }

    // Handle client disconnect
    for (const [clientId, client] of clients.entries()) {
      if (client.socketId === socket.id) {
        const agentId = client.pairedAgentId
        if (agentId) {
          const agent = agents.get(agentId)
          if (agent) agentToClient.delete(agentId)
          io.to(`agent:${agentId}`).emit('agent:unpaired', { clientId })
        }
        clients.delete(clientId)
        console.log(`Client disconnected: ${clientId}`)
        break
      }
    }

    // Handle WebRTC room disconnect
    for (const [roomId, room] of webrtcRooms.entries()) {
      let roomModified = false

      if (room.broadcasterId === socket.id) {
        room.broadcasterId = null
        roomModified = true
        // Notify all viewers that broadcaster left
        room.viewers.forEach(viewerId => {
          io.to(viewerId).emit('webrtc:broadcaster-left')
        })
        console.log(`Broadcaster left room ${roomId}`)
      }

      if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id)
        roomModified = true
        // Notify broadcaster that viewer left
        if (room.broadcasterId) {
          io.to(room.broadcasterId).emit('webrtc:viewer-left', { socketId: socket.id })
        }
        console.log(`Viewer left room ${roomId} (remaining: ${room.viewers.size})`)
      }

      // Clean up empty rooms
      if (roomModified && !room.broadcasterId && room.viewers.size === 0) {
        webrtcRooms.delete(roomId)
        console.log(`Room ${roomId} deleted (empty)`)
      }
    }
  })
})

function broadcastAgentList() {
  const list = Array.from(agents.values()).map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    capabilities: a.capabilities,
    lastSeen: a.lastSeen
  }))
  io.emit('agents:list', list)
}

// Cleanup stale agents
setInterval(() => {
  const now = Date.now()
  for (const [agentId, agent] of agents.entries()) {
    if (now - agent.lastSeen > 30000) { // 30s timeout
      agent.status = 'disconnected'
      const clientId = agentToClient.get(agentId)
      if (clientId) {
        const client = clients.get(clientId)
        if (client) client.pairedAgentId = null
        agentToClient.delete(agentId)
        io.to(`client:${clientId}`).emit('client:unpaired', { agentId })
      }
    }
  }
  broadcastAgentList()
}, 10000)

// Cleanup stale WebRTC rooms
setInterval(() => {
  const now = Date.now()
  for (const [roomId, room] of webrtcRooms.entries()) {
    // Remove rooms older than 1 hour with no broadcaster
    if (!room.broadcasterId && room.viewers.size === 0 && now - room.createdAt > 3600000) {
      webrtcRooms.delete(roomId)
      console.log(`Stale room ${roomId} cleaned up`)
    }
  }
}, 60000)

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`VirtualCam relay server running on port ${PORT}`)
})