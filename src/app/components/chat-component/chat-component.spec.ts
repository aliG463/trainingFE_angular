import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChatComponent } from './chat-component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem('training-fe-angular.conversations');

    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    httpTestingController = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render an empty conversation and a disabled message composer', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Assistant IA');
    expect(element.querySelector('.chat-sidebar__title')?.textContent).toContain('Conversations');
    expect(element.querySelector('[aria-label="Conversation"]')).toBeTruthy();
    expect(element.querySelector('label[for="message"]')?.textContent).toContain('Votre message');
    expect(element.querySelector('button[disabled]')).toBeTruthy();
    expect(element.querySelectorAll('.message')).toHaveLength(0);
  });

  it('should save conversations and restore them from the sidebar', async () => {
    component.draft = 'Comment fonctionne Angular ?';
    component.submitMessage();

    const request = httpTestingController.expectOne('https://localhost:7294/api/ChatBot/chat');
    request.flush({ answer: 'Angular est un framework.' });
    fixture.detectChanges();

    expect(component.conversations()).toHaveLength(1);
    expect(component.conversations()[0].title).toBe('Comment fonctionne Angular ?');
    expect(JSON.parse(localStorage.getItem('training-fe-angular.conversations') ?? '[]')).toHaveLength(1);

    fixture.destroy();
    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    expect(component.conversations()).toHaveLength(1);

    component.startNewConversation();
    fixture.detectChanges();
    expect(component.messages()).toHaveLength(0);

    const savedConversation = component.conversations()[0];
    component.selectConversation(savedConversation);
    fixture.detectChanges();
    expect(component.messages()).toEqual(savedConversation.messages);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Angular est un framework.');
  });

  it('should open and reduce the conversation sidebar', () => {
    const element = fixture.nativeElement as HTMLElement;
    const toggleButton = element.querySelector('.chat__sidebar-toggle') as HTMLButtonElement;

    toggleButton.click();
    fixture.detectChanges();
    expect(element.querySelector('.chat-sidebar')).toBeNull();
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');

    toggleButton.click();
    fixture.detectChanges();
    expect(element.querySelector('.chat-sidebar')).toBeTruthy();
    expect(toggleButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('should post the question and conversation history and display the answer', () => {
    component.messages.set([
      { role: 'User', content: 'Explique brièvement ce qu’est une API REST.' },
      { role: 'Assistant', content: 'Une API REST permet à des applications d’échanger des données via HTTP.' },
    ]);
    component.draft = 'Peux-tu donner un exemple ?';
    fixture.detectChanges();

    component.submitMessage();

    const request = httpTestingController.expectOne('https://localhost:7294/api/ChatBot/chat');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      question: 'Peux-tu donner un exemple ?',
      history: [
        { role: 'User', content: 'Explique brièvement ce qu’est une API REST.' },
        { role: 'Assistant', content: 'Une API REST permet à des applications d’échanger des données via HTTP.' },
      ],
    });

    request.flush({ answer: 'Voici un exemple.' });
    fixture.detectChanges();

    expect(component.messages().at(-1)).toEqual({ role: 'Assistant', content: 'Voici un exemple.' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Voici un exemple.');
  });

  it('should format bold titles and preserve answer line breaks', () => {
    component.messages.set([
      {
        role: 'Assistant',
        content: '**Résumé**\\nUne réponse claire.\\n\\nDétail **important**.',
      },
    ]);
    fixture.detectChanges();

    const bubble = (fixture.nativeElement as HTMLElement).querySelector('.message__bubble');
    expect(bubble?.querySelector('.message__line--title strong')?.textContent).toBe('Résumé');
    expect(bubble?.querySelectorAll('.message__line')).toHaveLength(3);
    expect(bubble?.querySelector('.message__line-break')).toBeTruthy();
    expect(bubble?.querySelector('.message__line:last-child strong')?.textContent).toBe('important');
    expect(bubble?.textContent).not.toContain('**');
  });

  it('should send the message when Enter is pressed in the composer', () => {
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    expect(textarea).toBeTruthy();

    component.draft = 'Bonjour';
    fixture.detectChanges();
    textarea?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

    const request = httpTestingController.expectOne('https://localhost:7294/api/ChatBot/chat');
    expect(request.request.body.question).toBe('Bonjour');
    request.flush({ answer: 'Bonjour !' });
  });

  it('should scroll the latest message into view when the conversation changes', async () => {
    const marker = (fixture.nativeElement as HTMLElement).querySelector('.chat__conversation-end');
    expect(marker).toBeTruthy();
    const scrollIntoView = vi.fn();
    Object.defineProperty(marker, 'scrollIntoView', { value: scrollIntoView });

    component.messages.set([{ role: 'User', content: 'Bonjour' }]);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
  });

  it('should keep the newline behavior when Shift+Enter is pressed', () => {
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea');
    expect(textarea).toBeTruthy();

    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    textarea?.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    httpTestingController.expectNone('https://localhost:7294/api/ChatBot/chat');
  });

  it('should display an error when the API request fails', () => {
    component.draft = 'Bonjour';
    component.submitMessage();

    const request = httpTestingController.expectOne('https://localhost:7294/api/ChatBot/chat');
    request.flush('Service unavailable', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(component.errorMessage()).toContain('Impossible de contacter le service');
    expect(component.draft).toBe('Bonjour');
    expect(component.messages()).toHaveLength(0);
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeTruthy();
  });
});
