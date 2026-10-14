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
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  private readonly latestMessage = viewChild<ElementRef<HTMLElement>>('latestMessage');
  draft = '';

  constructor(private readonly http: HttpClient) {
    afterRenderEffect(() => {
      this.messages();
      this.latestMessage()?.nativeElement.scrollIntoView?.({
        behavior: 'smooth',
        block: 'end',
      });
    });
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
}
