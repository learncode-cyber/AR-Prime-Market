// ✅ FEATURE 10: AI-Powered Live Chat
// Customer support with Claude AI

import { useState, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  sender: 'user' | 'bot' | 'agent'
  message: string
  timestamp: Date
  avatar?: string
}

export function LiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      message: 'Hello! How can I help you today?',
      timestamp: new Date(),
      avatar: '🤖',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      message: inputValue,
      timestamp: new Date(),
      avatar: '👤',
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // Call AI backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: inputValue,
          conversationHistory: messages,
        }),
      })

      const data = await response.json()

      // Add bot response
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        message: data.reply,
        timestamp: new Date(),
        avatar: '🤖',
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='fixed bottom-4 right-4 z-50'>
      {/* Chat button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-blue-600 transition'
      >
        💬
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className='absolute bottom-20 right-0 w-96 h-96 bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden'>
          {/* Header */}
          <div className='bg-blue-500 text-white p-4 flex justify-between items-center'>
            <h3 className='font-bold'>AR Prime Support</h3>
            <button onClick={() => setIsOpen(false)} className='text-xl'>
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className='flex-1 overflow-y-auto p-4 space-y-3'>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs px-4 py-2 rounded-lg ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className='flex justify-start'>
                <div className='bg-gray-200 px-4 py-2 rounded-lg'>
                  <span className='text-gray-600'>typing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className='border-t p-4 flex gap-2'>
            <input
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage()
                }
              }}
              placeholder='Type a message...'
              className='flex-1 border rounded px-3 py-2 text-sm'
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading}
              className='bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400'
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default LiveChat

