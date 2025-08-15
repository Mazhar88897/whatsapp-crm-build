"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { RefreshCw, Eye, EyeOff, Copy, Check, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
// Types for the API responses
type Model = {
  id: number
  name: string
  provider_name: string
  model_type: string
}

type LLMCredentials = {
  tenant_id: number
  model: Model
  api_key: string
  temperature: number
  config_id: number
  is_enabled?: boolean
}

type EmbeddingCredentials = {
  tenant_id: number
  model: Model
  api_key: string
  config_id: number
  is_enabled?: boolean
}

export default function ConfigurationPage() {
  const [activeTab, setActiveTab] = useState("llm")
  const [llmCredentials, setLlmCredentials] = useState<LLMCredentials | null>(null)
  const [embeddingCredentials, setEmbeddingCredentials] = useState<EmbeddingCredentials | null>(null)
  const [loading, setLoading] = useState(false)
  const [llmLoading, setLlmLoading] = useState(false)
  const [embeddingLoading, setEmbeddingLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deletingEmbedding, setDeletingEmbedding] = useState(false)
  const [togglingEmbedding, setTogglingEmbedding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Get tenant ID from session storage or use default
  const tenantId = useMemo(() => {
    const storedTenantId = sessionStorage.getItem('tenantID')
  
  }, [])

  // Get base URL with fallback
  const getBaseUrl = useCallback((): string => {
    const baseUrlFromEnv = process.env.NEXT_PUBLIC_API_BASE_URL
    if (baseUrlFromEnv) {
      return baseUrlFromEnv
    }
    // Fallback to the ngrok URL from the API documentation
    return "https://89f920c37057.ngrok-free.app"
  }, [])

  // Fetch LLM credentials
  const fetchLLMCredentials = useCallback(async () => {
    try {
      setLlmLoading(true)
      setError(null)
      
      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/ai-config/tenant/${tenantId}/llm-credentials`, {
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch LLM credentials: ${response.status}`)
      }

      const data = await response.json()
      setLlmCredentials(data)
      toast.success('LLM credentials fetched successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch LLM credentials')
      toast.error('Failed to fetch LLM credentials')
    } finally {
      setLlmLoading(false)
    }
  }, [tenantId, getBaseUrl])

  // Fetch embedding credentials
  const fetchEmbeddingCredentials = useCallback(async () => {
    try {
      setEmbeddingLoading(true)
      setError(null)
      
      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/ai-config/tenant/${tenantId}/embedding-credentials`, {
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch embedding credentials: ${response.status}`)
      }

      const data = await response.json()
      setEmbeddingCredentials(data)
      toast.success('Embedding credentials fetched successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to fetch embedding credentials')
      toast.error('Failed to fetch embedding credentials')
    } finally {
      setEmbeddingLoading(false)
    }
  }, [tenantId, getBaseUrl])

  // Fetch all credentials
  const fetchAllCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await Promise.all([
        fetchLLMCredentials(),
        fetchEmbeddingCredentials()
      ])
    } catch (err) {
      console.error('Error fetching credentials:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchLLMCredentials, fetchEmbeddingCredentials])

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(fieldName)
      toast.success(`${fieldName} copied to clipboard`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      toast.error('Failed to copy to clipboard')
    }
  }, [])

  // Toggle LLM enable/disable
  const toggleLLMEnable = useCallback(async (enabled: boolean) => {
    if (!llmCredentials) return
    
    try {
      const baseUrl = getBaseUrl()
      const endpoint = enabled ? 'enable' : 'disable'
      const response = await fetch(`${baseUrl}/ai-config/llm/${llmCredentials.config_id}/${endpoint}?skip_validation=false`, {
        method: 'PUT',
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} LLM config: ${response.status}`)
      }

      const data = await response.json()
      setLlmCredentials(prev => prev ? { ...prev, is_enabled: data.is_enabled } : null)
      toast.success(`LLM config ${enabled ? 'enabled' : 'disabled'} successfully`)
    } catch (err: any) {
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} LLM config: ${err.message}`)
    }
  }, [llmCredentials, getBaseUrl])

  // Delete LLM config
  const deleteLLMConfig = useCallback(async () => {
    if (!llmCredentials) return
    
    if (!confirm('Are you sure you want to delete this LLM configuration? This action cannot be undone.')) {
      return
    }
    
    setDeleting(true)
    try {
      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/ai-config/llm/${llmCredentials.config_id}`, {
        method: 'DELETE',
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete LLM config: ${response.status}`)
      }

      setLlmCredentials(null)
      toast.success('LLM configuration deleted successfully')
    } catch (err: any) {
      toast.error(`Failed to delete LLM config: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }, [llmCredentials, getBaseUrl])

  // Toggle embedding enable/disable
  const toggleEmbeddingEnable = useCallback(async (enabled: boolean) => {
    if (!embeddingCredentials) return
    
    try {
      const baseUrl = getBaseUrl()
      const endpoint = enabled ? 'enable' : 'disable'
      const response = await fetch(`${baseUrl}/ai-config/embedding/${embeddingCredentials.config_id}/${endpoint}?skip_validation=false`, {
        method: 'PUT',
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to ${endpoint} embedding config: ${response.status}`)
      }

      const data = await response.json()
      setEmbeddingCredentials(prev => prev ? { ...prev, is_enabled: data.is_enabled } : null)
      toast.success(`Embedding config ${enabled ? 'enabled' : 'disabled'} successfully`)
    } catch (err: any) {
      toast.error(`Failed to ${enabled ? 'enable' : 'disable'} embedding config: ${err.message}`)
    }
  }, [embeddingCredentials, getBaseUrl])

  // Delete embedding config
  const deleteEmbeddingConfig = useCallback(async () => {
    if (!embeddingCredentials) return
    
    if (!confirm('Are you sure you want to delete this embedding configuration? This action cannot be undone.')) {
      return
    }
    
    setDeletingEmbedding(true)
    try {
      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/ai-config/embedding/${embeddingCredentials.config_id}`, {
        method: 'DELETE',
        headers: {
          'accept': 'application/json',
          'ngrok-skip-browser-warning': '69420'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to delete embedding config: ${response.status}`)
      }

      setEmbeddingCredentials(null)
      toast.success('Embedding configuration deleted successfully')
    } catch (err: any) {
      toast.error(`Failed to delete embedding config: ${err.message}`)
    } finally {
      setDeletingEmbedding(false)
    }
  }, [embeddingCredentials, getBaseUrl])

  // Toggle API key visibility
  const toggleApiKeyVisibility = () => {
    setShowApiKeys(!showApiKeys)
  }

  useEffect(() => {
    fetchAllCredentials()
  }, [fetchAllCredentials])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Configuration</h1>
          <p className="text-muted-foreground">
            Manage your LLM and embedding model configurations
          </p>
        </div>
        <Button
          onClick={fetchAllCredentials}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

     

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="llm">LLM Configuration</TabsTrigger>
          <TabsTrigger value="embedding">Embedding Configuration</TabsTrigger>
        </TabsList>

        {/* LLM Tab */}
        <TabsContent value="llm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                LLM Credentials
                <Badge variant="secondary">Tenant {tenantId}</Badge>
              </CardTitle>
              <CardDescription>
                Large Language Model configuration and API credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {llmCredentials ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between w-full p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-lg text-foreground">{llmCredentials.model.name}</div>
                      <Badge variant="secondary" className="font-medium">{llmCredentials.model.provider_name}</Badge>
                      <Badge 
                        variant={llmCredentials.is_enabled ? "default" : "outline"}
                        className={`font-medium ${llmCredentials.is_enabled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                      >
                        {llmCredentials.is_enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={llmCredentials.is_enabled ?? false}
                            onCheckedChange={toggleLLMEnable}
                            className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                          />
                          <span className="text-xs text-muted-foreground">
                            {llmCredentials.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteLLMConfig}
                        disabled={deleting}
                        className="flex items-center gap-2 hover:bg-destructive/90 transition-colors"
                      >
                        {deleting ? (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {deleting ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {llmLoading ? 'Loading LLM credentials...' : 'No LLM credentials found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Embedding Tab */}
        <TabsContent value="embedding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Embedding Credentials
                <Badge variant="secondary">Tenant {tenantId}</Badge>
              </CardTitle>
              <CardDescription>
                Embedding model configuration and API credentials
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {embeddingCredentials ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between w-full p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-all duration-200 shadow-sm animate-in fade-in-0 slide-in-from-bottom-2">
                    <div className="flex items-center gap-3">
                      <div className="font-semibold text-lg text-foreground">{embeddingCredentials.model.name}</div>
                      <Badge variant="secondary" className="font-medium">{embeddingCredentials.model.provider_name}</Badge>
                      <Badge 
                        variant={embeddingCredentials.is_enabled ? "default" : "outline"}
                        className={`font-medium ${embeddingCredentials.is_enabled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                      >
                        {embeddingCredentials.is_enabled ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-3">
                        <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={embeddingCredentials.is_enabled ?? false}
                            onCheckedChange={toggleEmbeddingEnable}
                            className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-gray-300"
                          />
                          <span className="text-xs text-muted-foreground">
                            {embeddingCredentials.is_enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={deleteEmbeddingConfig}
                        disabled={deletingEmbedding}
                        className="flex items-center gap-2 hover:bg-destructive/90 transition-colors"
                      >
                        {deletingEmbedding ? (
                          <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {deletingEmbedding ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {embeddingLoading ? 'Loading embedding credentials...' : 'No embedding credentials found'}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
