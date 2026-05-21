import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { useMatch } from 'react-router-dom';

import { api } from '../../api/client';
import { streamChatMessage } from '../../api/chatStream';
import type { ChatMessage } from '../../api/types';
import { CitationPill } from '../ui/CitationPill';
import styles from './ChatPanel.module.css';

// ---------------------------------------------------------------------------
// Citation injection — walks React children, replaces [Q:uuid] markers
// ---------------------------------------------------------------------------

const CITATION_RE = /\[(Q|C|hint):([a-f0-9-]{36})(?::(\d+))?\]/g;

function splitCitations(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  CITATION_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CITATION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [, type, id, tier] = match;
    parts.push(
      <CitationPill
        key={`${id}-${match.index}`}
        type={type as 'Q' | 'C' | 'hint'}
        id={id}
        tier={tier != null ? parseInt(tier, 10) : undefined}
      />,
    );
    lastIndex = CITATION_RE.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function injectCitations(node: ReactNode): ReactNode {
  if (typeof node === 'string') {
    const parts = splitCitations(node);
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
  }
  if (Array.isArray(node)) {
    return (node as ReactNode[]).flatMap((child, i) => {
      const result = injectCitations(child);
      return Array.isArray(result)
        ? (result as ReactNode[]).map((r, j) =>
            React.isValidElement(r) ? React.cloneElement(r, { key: `${i}-${j}` }) : r,
          )
        : [result];
    });
  }
  if (React.isValidElement(node)) {
    const el = node as React.ReactElement<{ children?: ReactNode }>;
    return React.cloneElement(el, {}, injectCitations(el.props.children));
  }
  return node;
}

// ---------------------------------------------------------------------------
// ChatMarkdown — markdown + math (KaTeX) + citation pills
// ---------------------------------------------------------------------------

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

function withCitations(children: ReactNode) {
  return injectCitations(children);
}

function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={{
        p: ({ children }) => <p>{withCitations(children)}</p>,
        li: ({ children }) => <li>{withCitations(children)}</li>,
        td: ({ children }) => <td>{withCitations(children)}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export function ChatPanel() {
  const match = useMatch('/session/:sessionId');
  const studySessionId = match?.params.sessionId ?? null;

  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, streamingText]);

  const createSession = useCallback(async (ssId: string | null) => {
    setChatSessionId(null);
    setMessages([]);
    setStreamingText('');
    setError(null);
    try {
      const sess = await api.createChatSession(ssId);
      setChatSessionId(sess.chat_session_id);
      setTitle(ssId ? 'Session chat' : 'General chat');
    } catch (err) {
      setError('Could not start chat session');
      console.error(err);
    }
  }, []);

  useEffect(() => {
    createSession(studySessionId);
  }, [studySessionId, createSession]);

  const handleNew = () => createSession(studySessionId);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || !chatSessionId || isStreaming) return;

    setInputText('');
    setError(null);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content_md: text,
      cited_sources: null,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setIsStreaming(true);
    setStreamingText('');

    // Accumulate streamed text in a ref so the onDone closure can read it
    const accumulated = { current: '' };

    await streamChatMessage(
      chatSessionId,
      text,
      (delta) => {
        accumulated.current += delta;
        setStreamingText(accumulated.current);
      },
      (info) => {
        const finalText = accumulated.current;
        setIsStreaming(false);
        setStreamingText('');
        setMessages(prev => [
          ...prev,
          {
            id: info.message_id,
            role: 'assistant',
            content_md: finalText,
            cited_sources: null,
            created_at: new Date().toISOString(),
          },
        ]);
      },
      (err) => {
        setIsStreaming(false);
        setStreamingText('');
        setError(`Error: ${err.message}`);
      },
    );
  }, [inputText, chatSessionId, isStreaming]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.title}>{title ?? 'Chat'}</span>
        <button className={styles.newBtn} onClick={handleNew} title="New chat">
          ↺ New
        </button>
      </div>

      <div className={styles.messages}>
        {messages.length === 0 && !isStreaming && (
          <div className={styles.empty}>
            Ask anything about IB Math AA HL.
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.user : styles.assistant}`}
          >
            {msg.role === 'assistant' ? (
              <div className={styles.mdWrapper}>
                <ChatMarkdown content={msg.content_md} />
              </div>
            ) : (
              <span className={styles.userText}>{msg.content_md}</span>
            )}
          </div>
        ))}

        {isStreaming && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.mdWrapper}>
              <ChatMarkdown content={streamingText + ' ▍'} />
            </div>
          </div>
        )}

        {error && <div className={styles.errorMsg}>{error}</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.textarea}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask… (Enter send · Shift+Enter newline)"
          rows={2}
          disabled={!chatSessionId || isStreaming}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={!inputText.trim() || !chatSessionId || isStreaming}
        >
          {isStreaming ? '…' : '↑'}
        </button>
      </div>
    </div>
  );
}
