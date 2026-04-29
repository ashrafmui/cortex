'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUpIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Role = 'user' | 'assistant'
type Message = { id: string; role: Role; content: string }

export default function NewSession() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [input])

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages, isStreaming])

  const send = async () => {
    const text = input.trim()
    if (!text || isStreaming) return

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setIsStreaming(true)

    await new Promise((r) => setTimeout(r, 800))

    const reply: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: `Let's dig into "${text}". Want to start with the fundamentals, or do you have a specific question in mind?`,
    }
    setMessages((m) => [...m, reply])
    setIsStreaming(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex w-full h-[calc(100dvh-5rem)] flex-col overflow-hidden">
      {isEmpty ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
          <div className="text-center">
            <h1 className="text-4xl font-light">Start a Session</h1>
            <p className="text-muted-foreground mt-2">
              What do you want to learn about?
            </p>
          </div>
          <Composer
            inputRef={textareaRef}
            value={input}
            onChange={setInput}
            onKeyDown={onKeyDown}
            onSend={send}
            disabled={isStreaming}
            className="w-full max-w-2xl"
          />
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
              {messages.map((m) => (
                <Bubble key={m.id} message={m} />
              ))}
              {isStreaming && <TypingDots />}
            </div>
          </div>
          <div className="border-t bg-background">
            <div className="mx-auto w-full max-w-2xl px-4 py-4">
              <Composer
                inputRef={textareaRef}
                value={input}
                onChange={setInput}
                onKeyDown={onKeyDown}
                onSend={send}
                disabled={isStreaming}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-primary text-primary-foreground max-w-[80%]'
            : 'bg-muted text-foreground max-w-[85%]'
        )}
      >
        {message.content}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted rounded-2xl px-4 py-3 flex items-center gap-1">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
    </div>
  )
}

function Composer({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  disabled,
  className,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  disabled: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative rounded-2xl border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    >
      <textarea
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything"
        rows={1}
        className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-12 text-sm placeholder:text-muted-foreground focus-visible:outline-none max-h-[200px]"
      />
      <Button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        size="icon"
        className="absolute bottom-2 right-2 h-8 w-8 rounded-full"
      >
        <ArrowUpIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}
