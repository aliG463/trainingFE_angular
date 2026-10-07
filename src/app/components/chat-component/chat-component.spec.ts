import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatComponent } from './chat-component';

describe('ChatComponent', () => {
  let component: ChatComponent;
  let fixture: ComponentFixture<ChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the static conversation and disabled message composer', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Assistant IA');
    expect(element.querySelector('[aria-label="Conversation"]')).toBeTruthy();
    expect(element.querySelector('label[for="message"]')?.textContent).toContain('Votre message');
    expect(element.querySelector('button[disabled]')).toBeTruthy();
  });
});
