import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toast } from 'primeng/toast';
import { ConfirmPopup } from 'primeng/confirmpopup';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toast, ConfirmPopup],
  templateUrl: './app.html',
})
export class App {}
