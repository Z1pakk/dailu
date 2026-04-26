import { AuthState } from '@auth/state/auth.state';
import { HabitState } from '@habits/state/habit.state';
import { TagState } from '../modules/tags/state/tag.state';

export const states = [AuthState, HabitState, TagState];
