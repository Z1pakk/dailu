export type SelectItem<T extends string | number = string> = {
  label: string;
  value: T;
};
