"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Database, KeyRound, RefreshCcw, CheckCircle2, Plus, Save, Trash2 } from 'lucide-react'

export default function VectorDatabaseConfigPage() {
  const [tenantId, setTenantId] = useState<number>()
  const [apiKey, setApiKey] = useState<string>('')
  const [status, setStatus] = useState<string>('unknown')
  const [loading, setLoading] = useState<boolean>(false)

  useEffect(() => {
    const storedTenant = sessionStorage.getItem('tenantID')
    checkStatus()
  }, [])

  const refreshStatus = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/pinecone-config/${tenantId}/status`)
      const data = await res.json()
      setStatus(data.status || 'unknown')
    } catch (e) {
      setStatus('unknown')  
    }
  }

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/pinecone-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: sessionStorage.getItem('tenantId'), api_key: apiKey }),
      })
      if (res.status === 409) {
        toast.warning('Configuration already exists. Use Update instead.')
      } else if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      } else {
        toast.success('Configuration created')
        setApiKey('')
        refreshStatus()
      }
    } catch (e: any) {
      toast.error('Create failed')
    } finally {
      setLoading(false)
      checkStatus()
    }
  }

  const handleUpdate = async () => {
    setLoading(true)
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/pinecone-config/${sessionStorage.getItem('tenantId')}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey }),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      }
      toast.success('Configuration updated')
      setApiKey('')
      refreshStatus()
    } catch (e: any) {
      toast.error('Update failed')
    } finally {
      setLoading(false)
      checkStatus
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/pinecone-config/${sessionStorage.getItem('tenantId')}`, { method: 'DELETE' })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t)
      }
      toast.success('Configuration deleted')
      setApiKey('')
      refreshStatus()
    } catch (e: any) {
      toast.error('Delete failed')
    } finally {
      setLoading(false)
      checkStatus()
    }
  }
  const checkStatus = async () => {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/pinecone-config/${sessionStorage.getItem('tenantId')}/status`, {
      headers: {
      'ngrok-skip-browser-warning': '69420'
      }
    })
    const data = await res.json()
    setStatus(data.has_config ? 'Configured' : 'Not Configured')
  }

  const StatusBadge = () => {
    const getStatusInfo = () => {
      switch (status.toLowerCase()) {
        case 'configured':
          return { label: 'Configured', variant: 'default', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
        case 'not configured':
          return { label: 'Not Configured', variant: 'destructive', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
        default:
          return { label: 'Unknown', variant: 'secondary', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' }
      }
    }

    const statusInfo = getStatusInfo()
    
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-full ${statusInfo.bgColor} ${statusInfo.borderColor} border`}>
        <div className={`w-2 h-2 rounded-full ${statusInfo.color === 'text-green-600' ? 'bg-green-500' : statusInfo.color === 'text-red-600' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
        <span className={`text-sm font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 p-6 sm:p-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-gray-900 bg-clip-text text-transparent flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                <Database className="w-8 h-8 text-white" />
              </div>
              Vector Database
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Configure your Pinecone vector database credentials for AI-powered search and similarity matching.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <StatusBadge />
            <Button 
              variant="outline" 
              onClick={refreshStatus} 
              disabled={loading}
              className="border-gray-300 hover:border-blue-400 hover:bg-blue-50 transition-all duration-200"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Config Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-6">
            <CardTitle className="flex items-center gap-3 text-xl">
              <div className="p-2 bg-blue-100 rounded-lg">
                <KeyRound className="w-6 h-6 text-blue-600" />
              </div>
              Pinecone API Configuration
            </CardTitle>
            <div className="mt-4 pt-5 pb-5">
              <div className="flex items-center justify-between">
                
                <StatusBadge />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="space-y-4">
              <div className="grid gap-3">
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-blue-600" />
                  API Key
                </Label>
                <div className="relative">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="pcn-..."
                    className="h-12 text-lg font-mono border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  Your API key is encrypted and stored securely
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button disabled={loading} onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                Create
              </Button>
              <Button disabled={loading} onClick={handleUpdate} variant="secondary">
                <Save className="w-4 h-4 mr-2" />
                Update
              </Button>
              <Button disabled={loading} onClick={handleDelete} variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Reset
              </Button>
             
            </div>

            <p className="text-xs text-gray-500">Your API key is stored securely and never displayed.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
