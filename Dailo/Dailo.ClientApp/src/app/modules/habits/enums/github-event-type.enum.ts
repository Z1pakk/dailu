import { SelectItem } from '@shared/lib/select-item/select-item.type';
import { ValueOf } from '@shared/lib/types/value-of.type';

export const githubEventTypes = {
  push: 0,
  pullRequest: 1,
} as const;

export type GithubEventType = ValueOf<typeof githubEventTypes>;

export const githubEventTypeLabels: Record<GithubEventType, string> = {
  [githubEventTypes.push]: 'Push',
  [githubEventTypes.pullRequest]: 'Pull Request',
};

export const githubEventTypeSelectItems: SelectItem<GithubEventType>[] = [
  {
    label: githubEventTypeLabels[githubEventTypes.push],
    value: githubEventTypes.push,
  },
  {
    label: githubEventTypeLabels[githubEventTypes.pullRequest],
    value: githubEventTypes.pullRequest,
  },
];
