using FluentValidation;

namespace Habit.Application.Features.UpdateHabit;

public sealed class UpdateHabitCommandValidator : AbstractValidator<UpdateHabitCommand>
{
    public UpdateHabitCommandValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();

        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);

        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description is not null);

        RuleFor(x => x.Type).IsInEnum();

        RuleFor(x => x.Frequency.Type).IsInEnum();
        RuleFor(x => x.Frequency.TimesPerPeriod).GreaterThan(0);

        RuleFor(x => x.Target.Value).GreaterThan(0);

        When(
            x => x.EndDate is not null,
            () =>
            {
                RuleFor(x => x.EndDate).GreaterThan(DateOnly.FromDateTime(DateTime.UtcNow));
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
    }
}
