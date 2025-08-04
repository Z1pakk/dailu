using DevHabit.Api.Entities;
using FluentValidation;

namespace DevHabit.Api.DTOs.Habits;

public sealed class CreateHabitDtoValidator : AbstractValidator<CreateHabitDto>
{
    private static readonly string[] AllowedUnits =
    {
        "minutes",
        "hours",
        "steps",
        "km",
        "cal",
        "pages",
        "books",
        "tasks",
        "sessions",
    };

    private static readonly string[] AllowedUnitsForBinaryHabits = { "sessions", "tasks" };

    public CreateHabitDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MinimumLength(3).MaximumLength(100);

        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description is not null);

        RuleFor(x => x.Type).IsInEnum();

        RuleFor(x => x.Frequency.Type).IsInEnum();
        RuleFor(x => x.Frequency.TimesPerPeriod).GreaterThan(0);

        RuleFor(x => x.Target.Value).GreaterThan(0);

        RuleFor(x => x.Target.Unit)
            .NotEmpty()
            .Must(u => AllowedUnits.Contains(u.ToLowerInvariant()))
            .WithMessage($"Unit must be one of: {string.Join(", ", AllowedUnits)}");

        When(
            x => x.EndDAte is not null,
            () =>
            {
                RuleFor(x => x.EndDAte).GreaterThan(DateOnly.FromDateTime(DateTime.UtcNow));
            }
        );

        When(
            x => x.Milestone is not null,
            () =>
            {
                RuleFor(x => x.Milestone!.Target)
                    .GreaterThan(0)
                    .WithMessage("Milestone target must be greater than 0");
            }
        );

        RuleFor(x => x.Target.Unit)
            .NotEmpty()
            .Must((dto, unit) => IsTargetUnitCompatibleWithType(dto.Type, unit))
            .WithMessage("Target unit is not compatible with the habit type");
    }

    private static bool IsTargetUnitCompatibleWithType(HabitType type, string unit)
    {
        string normalizedUnit = unit.ToLowerInvariant();

        return type switch
        {
            // Binary habits should only use count-based units
            HabitType.Binary => AllowedUnitsForBinaryHabits.Contains(normalizedUnit),
            // Measurable habits can use any of the allowed units
            HabitType.Measurable => AllowedUnits.Contains(normalizedUnit),
            _ => false, // None is not valid
        };
    }
}
