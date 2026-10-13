import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ChatComponent } from './chat-component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;
  let httpTestingController: HttpTestingController;

  beforeEach(async () => {
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
    expect(element.querySelector('[aria-label="Conversation"]')).toBeTruthy();
    expect(element.querySelector('label[for="message"]')?.textContent).toContain('Votre message');
    expect(element.querySelector('button[disabled]')).toBeTruthy();
    expect(element.querySelectorAll('.message')).toHaveLength(0);
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
