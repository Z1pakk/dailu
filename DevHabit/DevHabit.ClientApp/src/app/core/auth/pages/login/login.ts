import { Component } from '@angular/core';
import { Password } from 'primeng/password';
import { Checkbox } from 'primeng/checkbox';
import { Button } from 'primeng/button';
import { FormsModule } from '@angular/forms';
import { InputText } from 'primeng/inputtext';

@Component({
  selector: 'app-login',
  imports: [
    Password,
    Checkbox,
    Button,
    FormsModule,
    InputText
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

}
