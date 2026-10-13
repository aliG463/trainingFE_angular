import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
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
  draft = '';

  constructor(private readonly http: HttpClient) {}

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
