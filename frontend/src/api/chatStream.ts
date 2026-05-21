import type { StreamDoneInfo } from './types';
import { authHeader, BASE_URL } from './client';

export type { StreamDoneInfo };

export async function streamChatMessage(
  chatSessionId: string,
  content: string,
  onChunk: (delta: string) => void,
  onDone: (info: StreamDoneInfo) => void,
  onError: (err: Error) => void,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${BASE_URL}/chat/sessions/${chatSessionId}/messages/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader() },
        body: JSON.stringify({ content_md: content }),
      },
    );
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (!response.ok) {
    onError(new Error(`HTTP ${response.status}`));
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let currentEvent = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (currentEvent === 'chunk' && parsed.delta != null) {
              onChunk(parsed.delta);
            } else if (currentEvent === 'done') {
              onDone(parsed as StreamDoneInfo);
            }
          } catch {
            // ignore malformed JSON
          }
        } else if (line === '') {
          currentEvent = '';
        }
      }
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    reader.releaseLock();
  }
}
