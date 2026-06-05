import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ParallaxContainerDirective } from './parallax-container.directive';

@Component({
  template: `<div parallaxContainer></div>`,
  imports: [ParallaxContainerDirective],
  standalone: true,
})
class TestHostComponent {}

describe('ParallaxContainerDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let directive: ParallaxContainerDirective;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    directive = fixture.debugElement
      .query(By.directive(ParallaxContainerDirective))
      .injector.get(ParallaxContainerDirective);
  });

  it('should create', () => {
    expect(directive).toBeTruthy();
  });

  it('addEffect returns a cleanup function', () => {
    const cleanup = directive.addEffect(() => {});
    expect(typeof cleanup).toBe('function');
  });

  it('fires registered effects when a frame is scheduled', fakeAsync(() => {
    const calls: [number, number][] = [];
    directive.addEffect((x, y) => calls.push([x, y]));

    directive.onMouseLeave();
    tick(32);

    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]![0]).toBeCloseTo(0, 2);
    expect(calls[0]![1]).toBeCloseTo(0, 2);
  }));

  it('does not fire an effect after its cleanup is called', fakeAsync(() => {
    const spy = jasmine.createSpy('effect');
    const cleanup = directive.addEffect(spy);
    cleanup();

    directive.onMouseLeave();
    tick(32);

    expect(spy).not.toHaveBeenCalled();
  }));

  it('cleaning up one effect does not affect others', fakeAsync(() => {
    const spy1 = jasmine.createSpy('effect1');
    const spy2 = jasmine.createSpy('effect2');
    const cleanup1 = directive.addEffect(spy1);
    directive.addEffect(spy2);

    cleanup1();
    directive.onMouseLeave();
    tick(32);

    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalled();
  }));
});
