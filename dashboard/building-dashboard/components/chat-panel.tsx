'use client'

import React from "react"

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { MessageCircle, Send, Upload, X, Maximize2, Minimize2, Bot, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  buildingData?: unknown
}

export function ChatPanel({ buildingData }: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: {
          id,
          messages,
          buildingData,
          uploadedFileName: uploadedFile?.name,
        },
      }),
    }),
  })

  const isLoading = status === 'streaming' || status === 'submitted'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    sendMessage({ text: input })
    setInput('')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-colors"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    )
  }

  return (
    <Card
      className={cn(
        'fixed z-50 flex flex-col bg-white shadow-2xl transition-all duration-300 border-0',
        isExpanded
          ? 'bottom-4 right-4 left-4 top-4 sm:left-auto sm:w-[600px] sm:h-[calc(100vh-32px)]'
          : 'bottom-6 right-6 w-[380px] h-[500px]'
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between border-b bg-emerald-600 text-white rounded-t-lg py-3 px-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          <CardTitle className="text-base font-semibold text-white">Building Analytics Assistant</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 hover:bg-emerald-700 rounded transition-colors"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-emerald-700 rounded transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Bot className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">Building Analytics Assistant</p>
            <p className="text-sm text-gray-500 mt-1">
              Connected to MCP server for Arduino sensor data
            </p>
            <div className="mt-4 space-y-2 text-left text-sm text-gray-500">
              <p className="font-medium text-gray-700">Try asking:</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>What is the current occupancy in CalIt2?</li>
                <li>Show me inflow/outflow data for the last hour</li>
                <li>Preprocess and analyze the uploaded data file</li>
                <li>Normalize the occupancy data</li>
              </ul>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {message.role === 'assistant' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <Bot className="h-4 w-4 text-emerald-600" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-4 py-2 max-w-[80%]',
                message.role === 'user'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              )}
            >
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <p key={index} className="text-sm whitespace-pre-wrap">
                      {part.text}
                    </p>
                  )
                }
                if (part.type === 'tool-invocation') {
                  return (
                    <div key={index} className="text-xs mt-2 p-2 bg-white/50 rounded border">
                      <span className="font-medium">Tool: </span>
                      {part.toolInvocation.toolName}
                      {part.toolInvocation.state === 'output-available' && (
                        <pre className="mt-1 text-xs overflow-x-auto">
                          {JSON.stringify(part.toolInvocation.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  )
                }
                return null
              })}
            </div>
            {message.role === 'user' && (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100">
              <Bot className="h-4 w-4 text-emerald-600 animate-pulse" />
            </div>
            <div className="rounded-lg px-4 py-2 bg-gray-100">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </CardContent>

      <div className="border-t p-4">
        {uploadedFile && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-emerald-50 rounded text-sm">
            <Upload className="h-4 w-4 text-emerald-600" />
            <span className="text-emerald-700 truncate flex-1">{uploadedFile.name}</span>
            <button onClick={() => setUploadedFile(null)} className="text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv,.json,.txt"
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about building data..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} className="shrink-0 bg-emerald-600 hover:bg-emerald-700">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </Card>
  )
}
