import { CreateTagRequestModel } from '../models/requests/create-tag.request';

const scope = '[Tag]';

/**
 * Get from cache or fetch from the api
 */
export class TagGetTags {
  static readonly type = `${scope} GetTags`;
}

/**
 * Fetch tags from the api
 */
export class TagFetchTags {
  static readonly type = `${scope} FetchTags`;
}

export class TagCreateTag {
  static readonly type = `${scope} CreateTag`;

  constructor(public payload: CreateTagRequestModel) {}
}
