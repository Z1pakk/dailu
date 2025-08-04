using FluentValidation;

namespace DevHabit.Api.DTOs.Tags;

public sealed class CreateTagDtoValidator : AbstractValidator<CreateTagDto>
{
    public CreateTagDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MinimumLength(3).MaximumLength(100);

        RuleFor(x => x.Description).MaximumLength(500);
    }
}
