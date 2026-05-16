using FluentValidation;

namespace HabitUser.Application.Features.UpdateUserProfile;

public sealed class UpdateUserProfileCommandValidator : AbstractValidator<UpdateUserProfileCommand>
{
    public UpdateUserProfileCommandValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required.")
            .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("First name cannot be only whitespace.")
            .MaximumLength(100).WithMessage("First name must not exceed 100 characters.");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required.")
            .Must(x => !string.IsNullOrWhiteSpace(x)).WithMessage("Last name cannot be only whitespace.")
            .MaximumLength(100).WithMessage("Last name must not exceed 100 characters.");
    }
}
