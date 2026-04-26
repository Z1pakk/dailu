import { CreateTagRequestModel } from '../models/requests/create-tag.request';

const scope = '[Tag]';

export class TagGetTags {
  static readonly type = `${scope} GetTags`;
}

export class TagCreateTag {
  static readonly type = `${scope} CreateTag`;

  constructor(public payload: CreateTagRequestModel) {}
}
