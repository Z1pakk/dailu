import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Store } from '@ngxs/store';
import { MessageService } from 'primeng/api';
import { of, Subject } from 'rxjs';
import { TagCreateTag, TagFetchTags } from '@tags/state/tag.action';
import { TagCreateFacadeService } from './tag-create-facade.service';

describe('TagCreateFacadeService', () => {
  let store: jasmine.SpyObj<Store>;
  let saveResult: Subject<void>;
  let facade: TagCreateFacadeService;

  const creates = () =>
    store.dispatch.calls.allArgs().map(([a]) => a).filter((a) => a instanceof TagCreateTag) as TagCreateTag[];

  beforeEach(() => {
    saveResult = new Subject<void>();
    store = jasmine.createSpyObj<Store>('Store', ['dispatch']);
    store.dispatch.and.callFake((action: unknown) => (action instanceof TagCreateTag ? saveResult : of(undefined)));
    TestBed.configureTestingModule({
      providers: [
        TagCreateFacadeService,
        { provide: Store, useValue: store },
        { provide: MessageService, useValue: jasmine.createSpyObj('MessageService', ['add']) },
      ],
    });
    facade = TestBed.inject(TagCreateFacadeService);
  });

  it('should not send a blank name', () => {
    facade.form.controls.name.setValue('   ');
    facade.submit().subscribe();
    expect(creates().length).toBe(0);
  });

  it('should send the name without # once, even when submitted twice', () => {
    facade.form.controls.name.setValue(' #health ');
    facade.submit().subscribe();
    facade.submit().subscribe();
    expect(creates().length).toBe(1);
    expect(creates()[0]!.payload).toEqual({ name: 'health', description: '' });
  });

  it('should refresh tags and clear the field after a successful save', () => {
    facade.form.controls.name.setValue('health');
    facade.submit().subscribe();
    saveResult.next();
    saveResult.complete();
    expect(store.dispatch).toHaveBeenCalledWith(jasmine.any(TagFetchTags));
    expect(facade.form.controls.name.value).toBe('');
    expect(facade.$isSubmitting()).toBeFalse();
  });

  it('should keep the server error on the name field', () => {
    facade.form.controls.name.setValue('health');
    facade.submit().subscribe();
    saveResult.error(new HttpErrorResponse({ status: 400, error: { errors: { Name: ['Tag already exists'] } } }));
    expect(facade.form.controls.name.getError('serverError')).toBe('Tag already exists');
    expect(facade.$isSubmitting()).toBeFalse();
  });
});
