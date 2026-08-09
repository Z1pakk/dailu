import { TestBed } from '@angular/core/testing';
import { IntersectionService } from './intersection.service';

describe('IntersectionService', () => {
  let service: IntersectionService;
  let mockObserver: jasmine.SpyObj<IntersectionObserver>;
  let capturedCallback: IntersectionObserverCallback;
  let el: HTMLElement;

  beforeEach(() => {
    mockObserver = jasmine.createSpyObj('IntersectionObserver', ['observe', 'disconnect']);
    spyOn(window, 'IntersectionObserver').and.callFake(
      function (cb: IntersectionObserverCallback) {
        capturedCallback = cb;
        return mockObserver;
      },
    );

    TestBed.configureTestingModule({});
    service = TestBed.inject(IntersectionService);
    el = document.createElement('div');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts observing the element immediately', () => {
    service.whenVisible(el, () => {});
    expect(mockObserver.observe).toHaveBeenCalledWith(el);
  });

  it('fires callback when element intersects', () => {
    const spy = jasmine.createSpy('callback');
    service.whenVisible(el, spy);

    capturedCallback(
      [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
      mockObserver,
    );

    expect(spy).toHaveBeenCalledOnceWith();
  });

  it('disconnects observer after first intersection', () => {
    service.whenVisible(el, () => {});
    capturedCallback(
      [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
      mockObserver,
    );
    expect(mockObserver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not fire callback when element is not intersecting', () => {
    const spy = jasmine.createSpy('callback');
    service.whenVisible(el, spy);

    capturedCallback(
      [{ isIntersecting: false, target: el } as unknown as IntersectionObserverEntry],
      mockObserver,
    );

    expect(spy).not.toHaveBeenCalled();
  });

  it('cleanup function disconnects the observer early', () => {
    const cleanup = service.whenVisible(el, () => {});
    cleanup();
    expect(mockObserver.disconnect).toHaveBeenCalledTimes(1);
  });

  it('passes options to IntersectionObserver constructor', () => {
    const options: IntersectionObserverInit = { threshold: 0.5 };
    service.whenVisible(el, () => {}, options);
    expect(window.IntersectionObserver).toHaveBeenCalledWith(
      jasmine.any(Function),
      options,
    );
  });
});
