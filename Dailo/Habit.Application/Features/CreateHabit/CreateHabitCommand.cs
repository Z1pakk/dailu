using Habit.Application.Models;
using Habit.Application.Persistence;
using Habit.Domain.Aggregates;
using Habit.Domain.Enums;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;

namespace Habit.Application.Features.CreateHabit;

public sealed record CreateHabitCommand(
    string Name,
    string? Description,
    HabitType Type,
    FrequencyModel Frequency,
    TargetModel Target,
    DateOnly? EndDate,
    MilestoneModel? Milestone
) : ICommand<Result<CreateHabitCommandResponse>>;

public sealed record CreateHabitCommandResponse(Guid Id);

public sealed class CreateHabitCommandHandler(
    IHabitDbContext dbContext,
    ICurrentUserService currentUserService
) : ICommandHandler<CreateHabitCommand, Result<CreateHabitCommandResponse>>
{
    public async ValueTask<Result<CreateHabitCommandResponse>> Handle(
        CreateHabitCommand request,
        CancellationToken cancellationToken
    )
    {
        var habitResult = HabitAggregate.Create(
            currentUserService.UserId,
            request.Name,
            request.Description,
            request.Type,
            request.Frequency.Type,
            request.Frequency.TimesPerPeriod,
            request.Target.Value,
            request.Target.Unit,
            request.EndDate,
            request.Milestone?.Target,
            request.Milestone?.Current
        );

        if (habitResult.IsFailure)
        {
            return Result<CreateHabitCommandResponse>.BadRequest(habitResult.Error);
        }

        var entity = habitResult.Value.ToEntity();

        dbContext.Habits.Add(entity);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result<CreateHabitCommandResponse>.Success(
            new CreateHabitCommandResponse(entity.Id.ToGuid())
        );
    }
}
