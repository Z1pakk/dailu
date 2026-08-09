import { inject, Injectable } from '@angular/core';
import { Action, State, StateContext } from '@ngxs/store';
import { TagModel } from '../models/tag.model';
import { TagApi } from '../api/tag.api';
import { TagFetchTags, TagCreateTag, TagGetTags } from './tag.action';
import { finalize, Observable, of, tap } from 'rxjs';
import { GetTagsResponseModel } from '../models/responses/get-tags.response';

export interface TagStateModel {
  isLoading: boolean;
  tags: TagModel[];
}

const defaults: TagStateModel = {
  isLoading: false,
  tags: [],
};

@Injectable()
@State<TagStateModel>({
  name: 'tags',
  defaults,
})
export class TagState {
  private readonly _api = inject(TagApi);

  @Action(TagGetTags)
  public getTags(ctx: StateContext<TagStateModel>, _: TagGetTags) {
    const stateTags = ctx.getState();

    if (stateTags.tags.length) {
      return of(stateTags.tags);
    }

    return ctx.dispatch(new TagFetchTags());
  }

  @Action(TagFetchTags)
  public fetchTags(
    ctx: StateContext<TagStateModel>,
    _: TagFetchTags,
  ): Observable<GetTagsResponseModel> {
    ctx.patchState({
      isLoading: true,
    });

    return this._api.get().pipe(
      tap((response: GetTagsResponseModel) => {
        ctx.patchState({
          tags: response.tags,
        });
      }),
      finalize(() => {
        ctx.patchState({
          isLoading: false,
        });
      }),
    );
  }

  @Action(TagCreateTag)
  public createTag(ctx: StateContext<TagStateModel>, action: TagCreateTag) {
    ctx.patchState({
      isLoading: true,
    });

    return this._api.create(action.payload).pipe(
      finalize(() => {
        ctx.patchState({
          isLoading: false,
        });
      }),
    );
  }
}
