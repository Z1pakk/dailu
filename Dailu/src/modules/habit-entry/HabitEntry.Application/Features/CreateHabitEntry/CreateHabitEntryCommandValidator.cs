using FluentValidation;
using StrictId;

namespace HabitEntry.Application.Features.CreateHabitEntry;

public sealed class CreateHabitEntryCommandValidator : AbstractValidator<CreateHabitEntryCommand>
{
    public CreateHabitEntryCommandValidator()
    {
        RuleFor(x => x.HabitId).NotEmpty();

        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);

        RuleFor(x => x.Notes).MaximumLength(2000).When(x => x.Notes is not null);

        RuleFor(x => x.CompletedAt).NotEmpty();
    }
}
