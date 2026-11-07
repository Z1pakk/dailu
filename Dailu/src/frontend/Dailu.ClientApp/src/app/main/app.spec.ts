import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { providePrimeNgServices } from './providers/prime-ng-services.provider';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [providePrimeNgServices()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
