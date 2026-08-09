import { AuthState } from '@auth/state/auth.state';
import { HabitState } from '@habits/state/habit.state';
import { HabitEntryState } from '@habit-entries/state/habit-entry.state';
import { TagState } from '@tags/state/tag.state';
import { UserProfileState } from '@user-profile/state/user-profile.state';

export const states = [AuthState, HabitState, HabitEntryState, TagState, UserProfileState];
