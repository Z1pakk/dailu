using Habit.Application.IntegratedServices;
using Habit.Application.Models;
using Habit.Application.Persistence;
using Habit.Domain.Aggregates;
using Habit.Domain.Enums;
using SharedKernel.CQRS;
using SharedKernel.ResultPattern;
using SharedKernel.User;
using StrictId;

namespace Habit.Application.Features.CreateHabit;

public sealed record CreateHabitCommand(
    string Name,
    string? Description,
    HabitType Type,
    FrequencyModel Frequency,
    TargetModel Target,
    DateOnly? EndDate,
    MilestoneModel? Milestone,
    IEnumerable<Id<TagModel>> TagIds,
    AutomationSource? AutomationSource
) : ICommand<Result<CreateHabitCommandResponse>>;

public sealed record CreateHabitCommandResponse(Id<HabitModel> Id);

public sealed class CreateHabitCommandHandler(
    IHabitDbContext dbContext,
    ICurrentUserService currentUserService,
    ITagService tagService
) : ICommandHandler<CreateHabitCommand, Result<CreateHabitCommandResponse>>
{
    public async ValueTask<Result<CreateHabitCommandResponse>> Handle(
        CreateHabitCommand request,
        CancellationToken cancellationToken
    )
    {
        var requestedTagIds = request.TagIds.ToHashSet();

        var tags = await tagService.GetByIdsAsync(requestedTagIds, cancellationToken);
        var existingTagIds = tags.Keys.Select(k => k.ToId()).ToHashSet();

        var habitResult = HabitAggregate.Create(
            Id<HabitAggregate>.NewId(),
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
            request.Milestone?.Current,
            requestedTagIds.Select(id => new Id(id.Value)).ToHashSet(),
            existingTagIds,
            lastCompletedAtUtc: null,
            request.AutomationSource
        );

        if (habitResult.IsFailure)
        {
            return habitResult.ToTargetResult<CreateHabitCommandResponse>();
        }

        var entity = habitResult.Value.ToEntity();

        dbContext.Habits.Add(entity);

        await dbContext.SaveChangesAsync(cancellationToken);

        return Result<CreateHabitCommandResponse>.Success(
            new CreateHabitCommandResponse(new Id<HabitModel>(entity.Id.Value))
        );
    }
}
