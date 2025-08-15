"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Loader2, MessageSquare, AlertCircle, UserPlus, UserMinus, Bot, User, BadgeCheck } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import axios from "axios"
import { toast } from "sonner"

const mockChats = [
  {
    id: 1,
    name: "System",
    avatar: "F",
    status: "Un Active",
    messages: [
      { id: 1, text: "No messages yet", time: "12:23 PM", fromMe: false },
      
    ],
  },

 
  // Add more chats if needed
]

export default function ChatsPage() {
  const [selectedChatKey, setSelectedChatKey] = useState<string | number | null>(null)
  const [input, setInput] = useState("")
  const [chats, setChats] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [conversationLoadingId, setConversationLoadingId] = useState<string | number | null>(null)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [conversationsById, setConversationsById] = useState<Record<string | number, any>>({})
  const [sending, setSending] = useState<boolean>(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Assignment controls
  const [agentIdInput, setAgentIdInput] = useState<string>("")
  const [aiEnabled, setAiEnabled] = useState<boolean>(false)

  // WS health and polling fallback
  const [wsOpenCount, setWsOpenCount] = useState<number>(0)
  const inboxWsUp = wsOpenCount > 0
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const messageIdsByConvRef = useRef<Record<string | number, Set<any>>>({})
  const [agentJoned, setAgentJoned] = useState<boolean>(false)
  const [currentJoinedConversationId, setCurrentJoinedConversationId] = useState<string | number | null>(null)

  useEffect(() => {
    const fetchInbox = async () => {
      try {
        setLoading(true)
        setError(null)

        const tenantID = sessionStorage.getItem('tenantID')
        const departmentID = sessionStorage.getItem('departmentID')

        const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
        if (!baseUrl) {
          throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')
        }

        const response = await axios.get(`${baseUrl}/inbox`, {
          params: {
            tenant_id: sessionStorage.getItem('tenantId'),
            department_id: sessionStorage.getItem('departmentId'),
            limit: 50,
            offset: 0,
          },
          headers: { 'ngrok-skip-browser-warning': '69420' },
        })

        const data = response?.data
        let items: any[] = []
        if (Array.isArray(data)) items = data
        else if (Array.isArray(data?.items)) items = data.items
        else if (Array.isArray(data?.data)) items = data.data
        else if (Array.isArray(data?.results)) items = data.results
        else items = []

        setChats(items)
      } catch (err: any) {
        console.error('Failed to fetch inbox:', err)
        setError(err?.message || 'Failed to fetch inbox')
      } finally {
        setLoading(false)
      }
    }

    fetchInbox()
  }, [])

  const uiChats = useMemo(() => {
    const source = chats.length ? chats : mockChats
    return source.map((chat: any, idx: number) => {
      const id = chat?.conversation_id ?? chat?.id ?? `idx-${idx}`
      const name = chat?.user_name ?? chat?.name ?? chat?.customer_name ?? chat?.sender ?? chat?.patient_whatsapp_number ?? `Chat ${idx + 1}`
      const avatar = (String(name)?.[0] || 'C').toUpperCase()
      const status = "Live Session"
      const unreadCount = chat?.unread_count ?? 0
      const lastMessage = chat?.message ?? '' 
      const timestamp = chat?.timestamp ?? chat?.updated_at ?? chat?.created_at
      const phone = chat?.patient_whatsapp_number ?? chat?.phone_number ?? ''
      const departmentName = chat?.department?.name ?? ''
      return { key: id, id, name, avatar, status, unreadCount, lastMessage, timestamp, phone, departmentName, _raw: chat }
    })
  }, [chats])

  useEffect(() => {
    if (selectedChatKey == null && uiChats.length) {
      setSelectedChatKey(uiChats[0].key)
    }
  }, [uiChats, selectedChatKey])

  const selectedChat = useMemo(() => uiChats.find((c) => c.key === selectedChatKey), [uiChats, selectedChatKey])
  const selectedChatId = useMemo(() => selectedChat?.id, [selectedChat])
  const selectedConversation = useMemo(() => {
    if (!selectedChat) return null
    return conversationsById[selectedChat.id] ?? null
  }, [conversationsById, selectedChat])

  const formatTime = (ts?: string) => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      return d.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true })
    } catch {
      return ''
    }
  }

  const truncate = (text: string, length = 36) => {
    if (!text) return ''
    return text.length > length ? `${text.slice(0, length)}…` : text
  }

  const reorder = (list: any[]) => {
    return [...list].sort((a, b) => {
      const at = a?.timestamp ? new Date(a.timestamp).getTime() : 0
      const bt = b?.timestamp ? new Date(b.timestamp).getTime() : 0
      return bt - at
    })
  }

  const openWS = (
    url: string,
    { onMessage, onOpen, onClose }: { onMessage?: (evt: MessageEvent) => void; onOpen?: () => void; onClose?: () => void } = {}
  ) => {
    let ws: WebSocket
    let heartbeat: ReturnType<typeof setInterval> | undefined
    let retryMs = 1000
    const connect = () => {
      ws = new WebSocket(url)
      ws.onopen = () => {
        heartbeat = setInterval(() => {
          try { ws.send(JSON.stringify({ type: 'ping' })) } catch {}
        }, 20000)
        retryMs = 1000
        onOpen && onOpen()
      }
      ws.onmessage = (evt) => onMessage && onMessage(evt)
      ws.onclose = () => {
        if (heartbeat) clearInterval(heartbeat)
        onClose && onClose()
        setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, 15000)
      }
      ws.onerror = () => { try { ws.close() } catch {} }
    }
    connect()
    return () => { try { if (heartbeat) clearInterval(heartbeat); ws.close() } catch {} }
  }

  const parseSessionNumber = (key: string): number | null => {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      const num = Number(parsed)
      return Number.isFinite(num) ? num : null
    } catch {
      const num = Number(raw)
      return Number.isFinite(num) ? num : null
    }
  }

  const fetchConversation = async (conversationId: string | number) => {
    try {
      setConversationError(null)
      setConversationLoadingId(conversationId)
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')
      const response = await axios.get(`${baseUrl}/conversations/${conversationId}`, {
        headers: { 'ngrok-skip-browser-warning': '69420' },
      })
              const data = response?.data
        console.log('data', data)
        
        // Store AI status per conversation
        if (data?.conversation?.is_ai_enabled !== undefined) {
          const key = `aiEnabled:${conversationId}`
          sessionStorage.setItem(key, JSON.stringify(data.conversation.is_ai_enabled))
          
          // Update local state if this is the currently selected conversation
          if (selectedChatId === conversationId) {
            setAiEnabled(data.conversation.is_ai_enabled)
          }
        }
        
        const messagesSource = Array.isArray(data) ? data : (Array.isArray(data?.messages) ? data.messages : [])

      const normalizedMessages = messagesSource.map((m: any, idx: number) => {
        const text = m?.content ?? m?.text ?? m?.message ?? m?.body ?? ''
        const time = m?.created_at ?? m?.timestamp ?? m?.time ?? m?.updated_at
        const type = m?.message_type ?? m?.type
        const senderTypeRaw = m?.sender_type ?? (m?.sender === 'agent' ? 'agent' : 'patient')
        const role = senderTypeRaw === 'bot' ? 'bot' : (senderTypeRaw === 'agent' || senderTypeRaw === 'admin' ? 'agent' : 'patient')
        const isOutbound = role === 'agent' || role === 'bot'
        return {
          id: m?.id ?? idx,
          text,
          time: formatTime(time),
          fromMe: Boolean(isOutbound),
          role,
          type,
          attachments: Array.isArray(m?.attachments) ? m.attachments : [],
        }
      })

      // seed seen message ids to avoid WS duplicates
      const seen = messageIdsByConvRef.current[conversationId] || new Set()
      for (const m of messagesSource) {
        if (m?.id != null) seen.add(m.id)
      }
      messageIdsByConvRef.current[conversationId] = seen
      setConversationsById(prev => ({ ...prev, [conversationId]: { messages: normalizedMessages, meta: data?.conversation ?? null, _raw: data } }))
    } catch (err: any) {
      console.error('Failed to fetch conversation:', err)
      setConversationError(err?.message || 'Failed to fetch conversation')
    } finally {
      setConversationLoadingId(null)
    }
  }

  useEffect(() => {
    if (selectedChatId != null) {
      fetchConversation(selectedChatId)
    }
  }, [selectedChatId])

  // Load/save AI toggle per conversation (UI-only for now)
  useEffect(() => {
    if (selectedChatId == null) return
    const key = `aiEnabled:${selectedChatId}`
    const stored = sessionStorage.getItem(key)
    setAiEnabled(stored === 'true')
  }, [selectedChatId])

  const handleToggleAi = async (value: boolean) => {
    if (selectedChatId == null) return
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')
      
              await axios.put(`${baseUrl}/conversations/${selectedChatId}/ai-toggle`, {
          is_ai_enabled: value
        }, {
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '69420' 
        }
      })
      
      // Update local state and session storage after successful API call
      setAiEnabled(value)
      const key = `aiEnabled:${selectedChatId}`
      sessionStorage.setItem(key, String(value))
      
      // Add system message to show AI status change
      const sysMsg = {
        id: `ai-toggle-${Date.now()}`,
        text: `AI ${value ? 'enabled' : 'disabled'} for this conversation`,
        time: formatTime(new Date().toISOString()),
        fromMe: false,
        role: 'system',
        type: 'text',
        attachments: []
      }
      
      setConversationsById(prev => {
        const existing = prev[selectedChatId]?.messages ?? []
        return { 
          ...prev, 
          [selectedChatId]: { 
            ...(prev[selectedChatId] || {}), 
            messages: [...existing, sysMsg] 
          } 
        }
      })
      
    } catch (err: any) {
      console.error('Failed to toggle AI:', err)
      // Revert the switch if API call fails
      setAiEnabled(!value)
      alert(err?.message || 'Failed to toggle AI status')
    }
  }

  // Inbox WS (dept + tenant) for realtime list updates
  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) return
    const wsBase = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')
    const deptParams = new URLSearchParams({
      tenant_id: sessionStorage.getItem('tenantId') || '',
      department_id: sessionStorage.getItem('departmentId') || '',
      'ngrok-skip-browser-warning': 'true'
    })
    const tenantParams = new URLSearchParams({
      tenant_id: sessionStorage.getItem('tenantId') || '',
      'ngrok-skip-browser-warning': 'true'
    })

    const onOpen = () => setWsOpenCount(n => n + 1)
    const onClose = () => setWsOpenCount(n => Math.max(0, n - 1))

    const applyInboxUpdate = ({ conversation_id, last_message, timestamp, unread_count }: any) => {
      let applied = false
      setChats(prev => {
        const list = [...prev]
        const idx = list.findIndex((c: any) => (c.conversation_id ?? c.id) === conversation_id)
        if (idx === -1) return prev
        const existing: any = list[idx]
        const existingTs = existing.timestamp ? new Date(existing.timestamp).getTime() : 0
        const incomingTs = timestamp ? new Date(timestamp).getTime() : 0
        if (incomingTs >= existingTs) {
          list[idx] = {
            ...existing,
            message: last_message ?? existing.message,
            timestamp: timestamp ?? existing.timestamp,
            unread_count: typeof unread_count === 'number' ? unread_count : existing.unread_count,
          }
          applied = true
        }
        return reorder(list)
      })
      return applied
    }

    const handleInboxWs = async (evt: MessageEvent) => {
      const msg = JSON.parse(evt.data || '{}')
      if (msg.type === 'conversation_created') {
        // refetch inbox
        try {
          const response = await axios.get(`${baseUrl}/inbox`, {
            params: { tenant_id: sessionStorage.getItem('tenantId'), department_id: sessionStorage.getItem('departmentId'), limit: 50, offset: 0 },
            headers: { 'ngrok-skip-browser-warning': '69420' },
          })
          const data = response?.data
          let items: any[] = []
          if (Array.isArray(data)) items = data
          else if (Array.isArray(data?.items)) items = data.items
          else if (Array.isArray(data?.data)) items = data.data
          else if (Array.isArray(data?.results)) items = data.results
          setChats(reorder(items))
        } catch {}
        return
      }
      if (msg.type === 'inbox_updated') {
        const ok = applyInboxUpdate({
          conversation_id: msg.conversation_id,
          last_message: msg.last_message,
          timestamp: msg.timestamp,
          unread_count: msg.unread_count,
        })
        if (!ok) {
          try {
            const response = await axios.get(`${baseUrl}/inbox`, {
              params: { tenant_id: sessionStorage.getItem('tenantId'), department_id: sessionStorage.getItem('departmentId'), limit: 50, offset: 0 },
              headers: { 'ngrok-skip-browser-warning': '69420' },
            })
            const data = response?.data
            let items: any[] = []
            if (Array.isArray(data)) items = data
            else if (Array.isArray(data?.items)) items = data.items
            else if (Array.isArray(data?.data)) items = data.data
            else if (Array.isArray(data?.results)) items = data.results
            setChats(reorder(items))
          } catch {}
        }
        return
      }
      if (msg.type === 'inbox_assignment') {
        setChats(prev => {
          const list = [...prev]
          const idx = list.findIndex((c: any) => (c.conversation_id ?? c.id) === msg.conversation_id)
          if (idx >= 0) {
            list[idx] = { ...list[idx], assigned_agent: msg.assigned_agent || null }
          }
          return list
        })
        return
      }
    }

    const stopDept = openWS(`${wsBase}/inbox/ws?${deptParams.toString()}`, { onMessage: handleInboxWs, onOpen, onClose })
    const stopTenant = openWS(`${wsBase}/inbox/ws?${tenantParams.toString()}`, { onMessage: handleInboxWs, onOpen, onClose })
    return () => { stopDept(); stopTenant() }
  }, [])

  // Polling fallback when inbox WS is down
  useEffect(() => {
    function start() {
      if (inboxWsUp) return
      stop()
      pollRef.current = setInterval(async () => {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
          if (!baseUrl) return
          const response = await axios.get(`${baseUrl}/inbox`, {
            params: { tenant_id: sessionStorage.getItem('tenantId'), department_id: sessionStorage.getItem('departmentId'), limit: 50, offset: 0 },
            headers: { 'ngrok-skip-browser-warning': '69420' },
          })
          const data = response?.data
          let items: any[] = []
          if (Array.isArray(data)) items = data
          else if (Array.isArray(data?.items)) items = data.items
          else if (Array.isArray(data?.data)) items = data.data
          else if (Array.isArray(data?.results)) items = data.results
          setChats(reorder(items))
        } catch {}
      }, 5000)
    }
    function stop() {
      if (pollRef.current) { clearInterval(pollRef.current as any); pollRef.current = null }
    }
    start()
    return stop
  }, [inboxWsUp])

  // Load AI status from session storage when conversation changes
  useEffect(() => {
    if (selectedChatId) {
      const key = `aiEnabled:${selectedChatId}`
      const stored = sessionStorage.getItem(key)
      if (stored !== null) {
        setAiEnabled(JSON.parse(stored))
      } else {
        // Default to false if no stored value
        setAiEnabled(false)
      }
    }
  }, [selectedChatId])

  // Chat WS for selected conversation
  useEffect(() => {
    if (selectedChatId == null) return
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
    if (!baseUrl) return
    const wsBase = baseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')
    const stop = openWS(`${wsBase}/chat/${selectedChatId}/ws`, {
      onMessage: (evt) => {
        const msg = JSON.parse(evt.data || '{}')
        if (msg.type === 'message') {
          const realId = msg.message_id
          if (realId != null) {
            const seen = messageIdsByConvRef.current[selectedChatId] || new Set()
            if (seen.has(realId)) return
            seen.add(realId)
            messageIdsByConvRef.current[selectedChatId] = seen
          }
          const role = msg.sender_type === 'bot' ? 'bot' : ((msg.sender_type === 'agent' || msg.sender_type === 'admin') ? 'agent' : 'patient')
          const isOutbound = role === 'agent' || role === 'bot'
          const newMsg = {
            id: msg.message_id,
            text: msg.content,
            time: formatTime(msg.timestamp),
            fromMe: Boolean(isOutbound),
            role,
            type: 'text',
            attachments: [],
          }
          setConversationsById(prev => {
            const existing = prev[selectedChatId]?.messages ?? []
            return { ...prev, [selectedChatId]: { ...(prev[selectedChatId] || {}), messages: [...existing, newMsg] } }
          })
          setTimeout(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight }, 0)
        }
        if (msg.type === 'agent_joined' || msg.type === 'agent_left') {
          const sysText = msg.type === 'agent_joined' ? `Agent ${msg.user_id} joined` : `Agent ${msg.user_id} left`
          const sysMsg = { id: `sys-${Date.now()}`, text: sysText, time: formatTime(msg.timestamp), fromMe: true, role: 'system', type: 'text', attachments: [] }
          setConversationsById(prev => {
            const existing = prev[selectedChatId]?.messages ?? []
            return { ...prev, [selectedChatId]: { ...(prev[selectedChatId] || {}), messages: [...existing, sysMsg] } }
          })
          fetchConversation(selectedChatId)
        }
        if (msg.type === 'conversation_assigned' || msg.type === 'conversation_unassigned') {
          const sysText = msg.type === 'conversation_assigned' ? `Conversation assigned to ${msg.agent_name || msg.agent_id}` : 'Conversation unassigned'
          const sysMsg = { id: `sys2-${Date.now()}`, text: sysText, time: formatTime(msg.timestamp), fromMe: true, role: 'system', type: 'text', attachments: [] }
          setConversationsById(prev => {
            const existing = prev[selectedChatId]?.messages ?? []
            return { ...prev, [selectedChatId]: { ...(prev[selectedChatId] || {}), messages: [...existing, sysMsg] } }
          })
          fetchConversation(selectedChatId)
        }
      }
    })
    // Load initial conversation details
    fetchConversation(selectedChatId)
    return stop
  }, [selectedChatId])

  // Cleanup effect to leave conversation when component unmounts or conversation changes
  useEffect(() => {
    return () => {
      // If we're currently in a conversation, leave it when unmounting
      if (currentJoinedConversationId) {
        autoLeaveConversation(currentJoinedConversationId)
      }
    }
  }, [currentJoinedConversationId])

  const sendMessage = async () => {
    if (!selectedChat || !input.trim()) return
    try {
      setSendError(null)
      setSending(true)
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')

      const tenantId = parseSessionNumber('tenantID')
      const departmentId = parseSessionNumber('departmentID')
      const userId = parseSessionNumber('userID')
      // if (!tenantId || !departmentId || !userId) {
      //   throw new Error('Missing tenant/department/user identifiers in session')
      // }

      // Optimistic update with dedupe key
      const tempId = `temp-${Date.now()}`
      const optimisticMessage = {
        id: tempId,
        text: input,
        time: formatTime(new Date().toISOString()),
        fromMe: true,
        role: 'agent',
        type: 'text',
        attachments: [],
      }
      setConversationsById(prev => {
        const existing = prev[selectedChat.id]?.messages ?? []
        return { ...prev, [selectedChat.id]: { ...(prev[selectedChat.id] || {}), messages: [...existing, optimisticMessage] } }
      })

      await axios.post(`${baseUrl}/chat/send-message`, {
        conversation_id: selectedChat.id,
        // conversation_id: 5,
        // department_id:   departmentId,
        department_id: sessionStorage.getItem('departmentId'),
        sender_type: 'agent',
        sender_user_id: sessionStorage.getItem('userRole'),
        tenant_id: sessionStorage.getItem('tenantId'),
        text: input,
      }, { headers: { 'ngrok-skip-browser-warning': '69420' } })

      setInput("")
      // Let WS event add the real message; optionally refresh after slight delay to reconcile
      setTimeout(() => fetchConversation(selectedChat.id), 400)
    } catch (err: any) {
      console.error('Failed to send message:', err)
      setSendError(err?.message || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Function to automatically join a conversation
  const autoJoinConversation = async (conversationId: string | number) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')

      await axios.post(`${baseUrl}/conversations/${conversationId}/join`, {
        tenant_id: sessionStorage.getItem('tenantId'),
        department_id: sessionStorage.getItem('departmentId'),
        user_id: sessionStorage.getItem('userID'),
        user_role: sessionStorage.getItem('userRole')
      }, { 
        headers: { 'ngrok-skip-browser-warning': '69420' } 
      })

      setCurrentJoinedConversationId(conversationId)
      setAgentJoned(true)
      toast.success(`Joined conversation`)
    } catch (err: any) {
      console.error('Failed to join conversation:', err)
      toast.error('Failed to join conversation')
    }
  }

  // Function to automatically leave a conversation
  const autoLeaveConversation = async (conversationId: string | number) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL
      if (!baseUrl) throw new Error('Missing NEXT_PUBLIC_API_BASE_URL')

      await axios.post(`${baseUrl}/conversations/${conversationId}/leave`, {
        tenant_id: sessionStorage.getItem('tenantId'),
        department_id: sessionStorage.getItem('departmentId'),
        user_id: sessionStorage.getItem('userID'),
        user_role: sessionStorage.getItem('userRole')
      }, { 
        headers: { 'ngrok-skip-browser-warning': '69420' } 
      })

      setCurrentJoinedConversationId(null)
      setAgentJoned(false)
      toast.success(`Left conversation`)
    } catch (err: any) {
      console.error('Failed to leave conversation:', err)
      toast.error('Failed to leave conversation')
    }
  }

  // Function to handle conversation switching with auto join/leave
  const handleConversationSwitch = async (newConversationId: string | number) => {
    // If we're currently in a conversation, leave it first
    if (currentJoinedConversationId && currentJoinedConversationId !== newConversationId) {
      await autoLeaveConversation(currentJoinedConversationId)
    }

    // Set the new conversation as selected
    setSelectedChatKey(newConversationId)
    
    // Join the new conversation
    await autoJoinConversation(newConversationId)
    
    // Fetch conversation data if not already loaded
    if (!conversationsById[newConversationId]) {
      fetchConversation(newConversationId)
    }
  }

  // Responsive: if mobile and a chat is selected, hide sidebar
  // We'll use a simple CSS approach for this demo

  return (
    <div className="flex h-screen bg-[#fafbfc]">
      {/* Sidebar */}
      <aside
        className={`
          w-80 max-w-full border-r bg-white flex-shrink-0 flex flex-col
          sticky top-0 left-0 h-screen z-20
          transition-transform duration-300
          md:translate-x-0
          ${selectedChatKey && typeof window !== 'undefined' && window.innerWidth < 768 ? '-translate-x-full absolute' : ''}
        `}
      >
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Chats</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {uiChats.map((chat) => (
            <button
              key={chat.key}
              onClick={() => handleConversationSwitch(chat.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors ${selectedChatKey === chat.key ? 'bg-gray-100' : ''}`}
            >
              <div className="w-10 h-10 rounded-full bg-purple-400 flex items-center justify-center text-white font-bold text-xl">
                {chat.avatar}
              </div>
              <div className="flex-1 text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm truncate max-w-[12rem]">{chat.name}                      </div>
                  <div className="text-[10px] text-gray-400">{formatTime(chat.timestamp)}</div>
                </div>
                <div className="text-[11px] text-gray-500 truncate max-w-[14rem]">
                  {truncate(chat.lastMessage || '')}
                </div>
                <div className="flex items-center gap-2 mr-[-5px]">
                  {chat.departmentName ? (
                    <span className=""><span className="text-[10px] bg-gray-800 text-white rounded-full px-2 py-[2px]">{chat.departmentName} Department</span>
</span>
                  ) : null}
                  {chat.unreadCount > 0 ? (
                    <span className="ml-auto text-[10px] bg-green-500 text-white rounded-full px-2 py-[2px]">
                      {chat.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat Window */}
      <main className="flex-1 flex flex-col h-screen relative">
        {/* Chat header */}
        {selectedChat && (
          <div className="flex items-center gap-3 px-6 py-4 border-b bg-white sticky top-0 z-10">
            <div className="w-10 h-10 rounded-full bg-purple-400 flex items-center justify-center text-white font-bold text-xl">
              {selectedChat.avatar}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-base">{selectedChat.name}</div>
              <div className="text-xs text-green-600 font-semibold flex items-center gap-1">
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">{selectedChat.status}</span>
              </div>
            </div>
            {/* Header controls: Join/Leave + AI toggle */}
            <div className="flex items-center gap-2">
              
              <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-gray-100">
                <span className={`w-2 h-2 rounded-full ${currentJoinedConversationId === selectedChat.id ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                <span className="text-xs text-gray-600">
                  {currentJoinedConversationId === selectedChat.id ? 'Joined' : 'Not Joined'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 pl-2 ml-2 border-l">
                <Bot className={`h-4 w-4 ${aiEnabled ? 'text-green-600' : 'text-gray-400'}`} />
                <span className="text-xs text-gray-600">AI</span>
                <Switch checked={aiEnabled} onCheckedChange={handleToggleAi} />
              </div>
            </div>
          </div>
        )}

        {/* Chat messages */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto px-4 py-8 flex flex-col gap-6">
          {(selectedConversation?.messages ?? []).map((msg: any) => (
            <div
              key={msg.id}
              className={`${msg.role === 'system' ? 'w-full flex justify-center' : `max-w-xs md:max-w-md lg:max-w-lg ${msg.fromMe ? 'ml-auto' : ''}`}`}
            >
              <div
                className={`rounded-xl px-5 py-3 shadow-sm text-base relative ${
                  msg.role === 'system'
                    ? 'bg-gray-100 text-gray-600 text-center border border-gray-200 max-w-md'
                    : msg.role === 'agent'
                      ? 'bg-green-400 text-white text-right'
                      : msg.role === 'bot'
                        ? 'bg-blue-50 text-blue-900 text-left border border-blue-200'
                      : 'bg-white text-gray-900 text-left border'
                }`}
              >
                <div className="whitespace-pre-wrap break-words">
                  {msg.type === 'image' ? (
                    <span>[image]</span>
                  ) : msg.type === 'document' ? (
                    <span>[document] {msg.text}</span>
                  ) : (
                    msg.text
                  )}
                </div>
                <div className={`flex items-center gap-2 text-xs mt-2 ${msg.role === 'agent' ? 'text-green-100 justify-end' : msg.role === 'bot' ? 'text-blue-500' : msg.role === 'system' ? 'text-gray-500 justify-center' : 'text-gray-400'}`}>
                  {msg.role === 'patient' && <User className="h-3.5 w-3.5" />}
                  {msg.role === 'agent' && <BadgeCheck className="h-3.5 w-3.5" />}
                  {msg.role === 'bot' && <Bot className="h-3.5 w-3.5" />}
                  {msg.role === 'system' && <BadgeCheck className="h-3.5 w-3.5" />}
                  <span className="capitalize">{msg.role}</span>
                  <span className="opacity-70">•</span>
                  <span>{msg.time}</span>
                </div>
              </div>
            </div>
          ))}
          {/* {!loading && !error && selectedChat && (!selectedConversation?.messages || selectedConversation.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
              <MessageSquare className="h-16 w-16 mb-4" />
              <div className="text-lg font-semibold">No messages yet</div>
              <div className="text-sm text-gray-500 mt-1">Start the conversation by sending a message.</div>
            </div>
          )}
          {loading && !selectedChat && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
              <Loader2 className="h-16 w-16 mb-4 animate-spin" />
              <div className="text-lg font-semibold">Loading chats…</div>
              <div className="text-sm text-gray-500 mt-1">Fetching your latest conversations.</div>
            </div>
          )}
          {conversationLoadingId && selectedChat && conversationLoadingId === selectedChat.id && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-gray-600">
              <Loader2 className="h-16 w-16 mb-4 animate-spin" />
              <div className="text-lg font-semibold">Loading conversation…</div>
              <div className="text-sm text-gray-500 mt-1">Please wait while we sync messages.</div>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-red-500">
              <AlertCircle className="h-16 w-16 mb-4" />
              <div className="text-lg font-semibold">Something went wrong</div>
              <div className="text-sm opacity-90 mt-1">{error}</div>
            </div>
          )} */}
          {conversationError && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-green-500">
              <AlertCircle className="h-16 w-16 mb-4" />
              <div className="text-lg font-semibold">Select a conversation</div>
              <div className="text-sm opacity-90 mt-1">select a conversation from the list</div>
            </div>
          )}
        </div>

        {/* Chat input (fixed at bottom) */}
        {selectedChat && (
          <form
            className="w-full flex gap-2 p-4 bg-white border-t sticky bottom-0 z-20"
            onSubmit={e => {
              e.preventDefault()
              sendMessage()
            }}
          >
            <input
              type="text"
              className="flex-1 rounded-full border px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Type a message..."
              value={input}
              onChange={e => setInput(e.target.value)}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              aria-busy={sending}
              className={`bg-green-400 text-white font-semibold px-6 py-2 rounded-full transition-colors ${sending || !input.trim() ? 'opacity-60 cursor-not-allowed' : 'hover:bg-green-500'}`}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            {sendError ? (
              <div className="flex items-center gap-2 text-sm text-red-500 self-center">
                <AlertCircle className="h-4 w-4" />
                <span>{sendError}</span>
              </div>
            ) : null}
          </form>
        )}
      </main>

      {/* Responsive overlay for mobile: show chat only */}
      <style jsx global>{`
        @media (max-width: 767px) {
          aside {
            position: fixed !important;
            left: 0;
            top: 0;
            height: 100vh;
            z-index: 30;
            width: 80vw !important;
            max-width: 320px;
            background: #fff;
            transition: transform 0.3s;
          }
          main {
            width: 100vw !important;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  )
}
