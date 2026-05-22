using FluentValidation;

namespace HabitEntry.Application.Features.UpdateHabitEntry;

public sealed class UpdateHabitEntryCommandValidator : AbstractValidator<UpdateHabitEntryCommand>
{
    public UpdateHabitEntryCommandValidator()
    {
        RuleFor(x => x.EntryId).NotEmpty();

        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);

        RuleFor(x => x.Notes).MaximumLength(2000).When(x => x.Notes is not null);

        RuleFor(x => x.CompletedAt).NotEmpty();
    }
}
