import { Component } from '@angular/core';
import { ChatComponent } from './components/chat-component/chat-component';

@Component({
  selector: 'app-root',
  imports: [ChatComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {}
