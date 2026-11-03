import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

type ChatRole = 'User' | 'Assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: string;
}

interface ChatResponse {
  answer: string;
}

interface MessageSegment {
  text: string;
  bold: boolean;
}

interface MessageLine {
  segments: MessageSegment[];
  isTitle: boolean;
  isBlank: boolean;
}

const CONVERSATIONS_STORAGE_KEY = 'training-fe-angular.conversations';

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null || !('role' in value) || !('content' in value)) {
    return false;
  }

  return (
    (value.role === 'User' || value.role === 'Assistant') &&
    typeof value.content === 'string'
  );
}

function isConversation(value: unknown): value is Conversation {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('title' in value) ||
    !('messages' in value) ||
    !('updatedAt' in value)
  ) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.messages) &&
    value.messages.every(isChatMessage) &&
    typeof value.updatedAt === 'string'
  );
}

@Component({
  selector: 'app-chat-component',
  imports: [FormsModule],
  templateUrl: './chat-component.html',
  styleUrl: './chat-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent {
  private readonly chatEndpoint = 'https://localhost:7294/api/ChatBot/chat';

  readonly messages = signal<ChatMessage[]>([]);
  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversationId = signal<string | null>(null);
  readonly isSidebarOpen = signal(true);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  private readonly latestMessage = viewChild<ElementRef<HTMLElement>>('latestMessage');
  draft = '';

  constructor(private readonly http: HttpClient) {
    this.conversations.set(this.readConversations());

    afterRenderEffect(() => {
      this.messages();
      this.latestMessage()?.nativeElement.scrollIntoView?.({
        behavior: 'smooth',
        block: 'end',
      });
    });
  }

  toggleSidebar(): void {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  startNewConversation(): void {
    this.activeConversationId.set(null);
    this.messages.set([]);
    this.draft = '';
    this.errorMessage.set(null);
  }

  selectConversation(conversation: Conversation): void {
    this.activeConversationId.set(conversation.id);
    this.messages.set(conversation.messages);
    this.draft = '';
    this.errorMessage.set(null);
  }

  formatMessage(content: string): MessageLine[] {
    return content
      .replace(/\\r\\n|\\n/g, '\n')
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => {
        const titleMatch = line.trim().match(/^\*\*(.+)\*\*$/);
        const text = titleMatch ? titleMatch[1] : line;
        const segments: MessageSegment[] = [];
        if (titleMatch) {
          segments.push({ text, bold: true });
        } else {
          const boldPattern = /\*\*(.+?)\*\*/g;
          let lastIndex = 0;

          for (const match of text.matchAll(boldPattern)) {
            const matchIndex = match.index;
            if (matchIndex > lastIndex) {
              segments.push({ text: text.slice(lastIndex, matchIndex), bold: false });
            }
            segments.push({ text: match[1], bold: true });
            lastIndex = matchIndex + match[0].length;
          }

          if (lastIndex < text.length || segments.length === 0) {
            segments.push({ text: text.slice(lastIndex), bold: false });
          }
        }

        return {
          segments,
          isTitle: titleMatch !== null,
          isBlank: line.trim().length === 0,
        };
      });
  }

  handleEnter(event: Event): void {
    if (event instanceof KeyboardEvent && event.shiftKey) {
      return;
    }

    event.preventDefault();
    this.submitMessage();
  }

  submitMessage(): void {
    const question = this.draft.trim();
    if (!question || this.isLoading()) {
      return;
    }

    const history = this.messages();
    const conversationId = this.activeConversationId() ?? crypto.randomUUID();
    this.activeConversationId.set(conversationId);
    this.messages.update((messages) => [
      ...messages,
      { role: 'User', content: question },
    ]);
    this.draft = '';
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.http
      .post<ChatResponse>(this.chatEndpoint, { question, history })
      .subscribe({
        next: (response) => {
          if (typeof response?.answer !== 'string' || !response.answer.trim()) {
            this.messages.set(history);
            this.draft = question;
            this.errorMessage.set('La réponse reçue de l’API est invalide.');
            this.isLoading.set(false);
            return;
          }

          this.messages.update((messages) => [
            ...messages,
            { role: 'Assistant', content: response.answer },
          ]);
          this.saveConversation(conversationId);
          this.isLoading.set(false);
        },
        error: () => {
          this.messages.set(history);
          this.draft = question;
          this.errorMessage.set('Impossible de contacter le service. Veuillez réessayer.');
          this.isLoading.set(false);
        },
      });
  }

  private readConversations(): Conversation[] {
    try {
      const savedConversations = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (savedConversations === null) {
        return [];
      }

      const parsed: unknown = JSON.parse(savedConversations);
      if (!Array.isArray(parsed) || !parsed.every(isConversation)) {
        throw new Error('Stored conversations have an invalid format.');
      }

      return parsed;
    } catch {
      this.errorMessage.set('Impossible de charger les conversations enregistrées.');
      return [];
    }
  }

  private saveConversation(id: string): void {
    const messages = this.messages();
    const firstQuestion = messages.find((message) => message.role === 'User')?.content;
    if (!firstQuestion) {
      return;
    }

    const title = firstQuestion.length > 48 ? `${firstQuestion.slice(0, 47)}…` : firstQuestion;
    const conversation: Conversation = {
      id,
      title,
      messages,
      updatedAt: new Date().toISOString(),
    };
    const conversations = [
      conversation,
      ...this.conversations().filter((item) => item.id !== id),
    ];

    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
      this.conversations.set(conversations);
    } catch {
      this.errorMessage.set('Impossible d’enregistrer la conversation sur cet appareil.');
    }
  }
}
