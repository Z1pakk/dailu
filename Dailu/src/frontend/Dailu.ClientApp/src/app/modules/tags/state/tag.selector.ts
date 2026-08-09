import { createPropertySelectors } from '@ngxs/store';
import { TagState, TagStateModel } from './tag.state';

export class TagStateSelectors {
  static readonly getSlices = createPropertySelectors<TagStateModel>(TagState);
}
