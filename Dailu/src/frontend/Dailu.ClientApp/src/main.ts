import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from '@main/app.config';
import { App } from '@main/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
