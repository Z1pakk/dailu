using System.Dynamic;
using System.Net.Mime;
using Asp.Versioning;
using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.Habits;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using DevHabit.Api.Services.Sorting;
using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SystemTextJsonPatch;

namespace DevHabit.Api.Controllers;

[Authorize]
[ApiController]
[Route("habits")]
[ApiVersion(1.0)]
[Produces(
    MediaTypeNames.Application.Json,
    CustomMediaTypeNames.Application.JsonV1,
    CustomMediaTypeNames.Application.JsonV2,
    CustomMediaTypeNames.Application.HateoasJson,
    CustomMediaTypeNames.Application.HateoasJsonV1,
    CustomMediaTypeNames.Application.HateoasJsonV2
)]
public class HabitsController(
    ApplicationDbContext dbContext,
    LinkService linkService,
    UserContext userContext
) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHabits(
        [FromQuery] HabitsQueryParameters queryParams,
        [FromServices] SortMappingProvider sortMappingProvider,
        [FromServices] DataShapingService dataShapingService
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        if (!sortMappingProvider.ValidateMappings<HabitDto, Habit>(queryParams.Sort))
        {
            return Problem(
                detail: $"The sort parameter is invalid: {queryParams.Sort}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        if (!dataShapingService.Validate<HabitDto>(queryParams.Fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {queryParams.Fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        queryParams.SearchQuery ??= queryParams.SearchQuery?.Trim().ToLowerInvariant();

        IQueryable<Habit> query = dbContext.Habits;

        SortMapping[] sortMappings = sortMappingProvider.GetMappings<HabitDto, Habit>();

        if (!string.IsNullOrEmpty(queryParams.SearchQuery))
        {
            query = query.Where(h =>
                h.Name.ToLower().Contains(queryParams.SearchQuery)
                || h.Description != null
                    && h.Description.ToLower().Contains(queryParams.SearchQuery)
            );
        }

        if (queryParams.Type is not null)
        {
            query = query.Where(h => h.Type == queryParams.Type);
        }

        if (queryParams.Status is not null)
        {
            query = query.Where(h => h.Status == queryParams.Status);
        }

        IQueryable<HabitDto> habitsQuery = query
            .Where(h => h.UserId == userId)
            .ApplySort(queryParams.Sort, sortMappings)
            .Select(HabitQueries.ProjectToDto());

        int totalCount = await habitsQuery.CountAsync();

        List<HabitDto> habits = await habitsQuery
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        var paginationResult = new PaginationResult<ExpandoObject>()
        {
            Items = dataShapingService.ShapeCollectionData(
                habits,
                queryParams.Fields,
                queryParams.IsLinksIncluded
                    ? h => CreateLinksForHabit(h.Id, queryParams.Fields)
                    : null
            ),
            Page = queryParams.Page,
            PageSize = queryParams.PageSize,
            TotalCount = totalCount,
        };
        if (queryParams.IsLinksIncluded)
        {
            paginationResult.Links = CreateLinksForHabits(
                queryParams,
                paginationResult.HasNextPage,
                paginationResult.HasPreviousPage
            );
        }

        return Ok(paginationResult);
    }

    [HttpGet]
    [Route("{id}")]
    [ApiVersion(1.0)]
    public async Task<IActionResult> GetHabit(
        [FromRoute] string id,
        [FromQuery] HabitsQueryParameters queryParams,
        [FromServices] DataShapingService dataShapingService
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        if (!dataShapingService.Validate<HabitWithTagsDto>(queryParams.Fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {queryParams.Fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        HabitWithTagsDto? habitDto = await dbContext
            .Habits.Where(h => h.Id == id && h.UserId == userId)
            .Select(HabitQueries.ProjectToDtoWithTags())
            .FirstOrDefaultAsync();

        if (habitDto == null)
        {
            return NotFound();
        }

        ExpandoObject shapedHabitDto = dataShapingService.ShapeData(habitDto, queryParams.Fields);

        if (queryParams.IsLinksIncluded)
        {
            IEnumerable<LinkDto> links = CreateLinksForHabit(id, queryParams.Fields);

            shapedHabitDto.TryAdd("links", links);
        }

        return Ok(shapedHabitDto);
    }

    [HttpGet]
    [Route("{id}")]
    [ApiVersion(2.0)]
    public async Task<IActionResult> GetHabitV2(
        [FromRoute] string id,
        [FromQuery] string? fields,
        [FromHeader(Name = "Accept")] string acceptHeader,
        [FromServices] DataShapingService dataShapingService
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        if (!dataShapingService.Validate<HabitWithTagsDtoV2>(fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        HabitWithTagsDtoV2? habitDto = await dbContext
            .Habits.Where(h => h.Id == id && h.UserId == userId)
            .Select(HabitQueries.ProjectToDtoWithTagsV2())
            .FirstOrDefaultAsync();

        if (habitDto == null)
        {
            return NotFound();
        }

        ExpandoObject shapedHabitDto = dataShapingService.ShapeData(habitDto, fields);

        bool isLinksIncluded = acceptHeader == CustomMediaTypeNames.Application.HateoasJson;
        if (isLinksIncluded)
        {
            IEnumerable<LinkDto> links = CreateLinksForHabit(id, fields);

            shapedHabitDto.TryAdd("links", links);
        }

        return Ok(shapedHabitDto);
    }

    [HttpPost]
    public async Task<ActionResult<HabitDto>> CreateHabit(
        [FromBody] CreateHabitDto createHabitDto,
        [FromServices] IValidator<CreateHabitDto> validator
    )
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        await validator.ValidateAndThrowAsync(createHabitDto);

        Habit habit = createHabitDto.ToEntity(userId);

        dbContext.Habits.Add(habit);
        await dbContext.SaveChangesAsync();

        HabitDto habitDto = habit.ToDto();

        habitDto.Links = CreateLinksForHabit(habit.Id, null);

        return CreatedAtAction(nameof(GetHabit), new { id = habit.Id }, habitDto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateHabit(string id, [FromBody] UpdateHabitDto updateHabitDto)
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h =>
            h.Id == id && h.UserId == userId
        );

        if (habit is null)
        {
            return NotFound();
        }

        habit.UpdateFromDto(updateHabitDto);

        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult> PatchHabit(string id, JsonPatchDocument<HabitDto> patchDocument)
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h =>
            h.Id == id && h.UserId == userId
        );
        if (habit is null)
        {
            return NotFound();
        }

        HabitDto habitDto = habit.ToDto();

        patchDocument.ApplyTo(habitDto);

        if (!TryValidateModel(habitDto))
        {
            return ValidationProblem(ModelState);
        }

        habit.Name = habitDto.Name;
        habit.Description = habitDto.Description;
        habit.UpdatedAtUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteHabit(string id)
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h =>
            h.Id == id && h.UserId == userId
        );

        if (habit is null)
        {
            return NotFound();
        }

        dbContext.Habits.Remove(habit);
        await dbContext.SaveChangesAsync();

        return NoContent();
    }

    private List<LinkDto> CreateLinksForHabits(
        HabitsQueryParameters queryParams,
        bool hasNextPage = false,
        bool hasPreviousPage = false
    )
    {
        List<LinkDto> links =
        [
            linkService.Create(
                nameof(GetHabits),
                "self",
                HttpMethods.Get,
                new
                {
                    page = queryParams.Page,
                    pageSize = queryParams.PageSize,
                    sort = queryParams.Sort,
                    q = queryParams.SearchQuery,
                    type = queryParams.Type,
                    status = queryParams.Status,
                    fields = queryParams.Fields,
                }
            ),
            linkService.Create(nameof(CreateHabit), "create", HttpMethods.Post),
        ];

        if (hasNextPage)
        {
            links.Add(
                linkService.Create(
                    nameof(GetHabits),
                    "next-page",
                    HttpMethods.Get,
                    new
                    {
                        page = queryParams.Page + 1,
                        pageSize = queryParams.PageSize,
                        sort = queryParams.Sort,
                        q = queryParams.SearchQuery,
                        type = queryParams.Type,
                        status = queryParams.Status,
                        fields = queryParams.Fields,
                    }
                )
            );
        }

        if (hasPreviousPage)
        {
            links.Add(
                linkService.Create(
                    nameof(GetHabits),
                    "previous-page",
                    HttpMethods.Get,
                    new
                    {
                        page = queryParams.Page - 1,
                        pageSize = queryParams.PageSize,
                        sort = queryParams.Sort,
                        q = queryParams.SearchQuery,
                        type = queryParams.Type,
                        status = queryParams.Status,
                        fields = queryParams.Fields,
                    }
                )
            );
        }

        return links;
    }

    private IEnumerable<LinkDto> CreateLinksForHabit(string id, string? fields)
    {
        return
        [
            linkService.Create(nameof(GetHabit), "self", HttpMethods.Get, new { id, fields }),
            linkService.Create(nameof(UpdateHabit), "update", HttpMethods.Put, new { id }),
            linkService.Create(nameof(PatchHabit), "partial-update", HttpMethods.Patch, new { id }),
            linkService.Create(nameof(DeleteHabit), "delete", HttpMethods.Delete, new { id }),
            linkService.Create(
                nameof(HabitTagsController.UpsertHabitTags),
                "upsert-tags",
                HttpMethods.Put,
                new { habitId = id },
                HabitTagsController.Name
            ),
        ];
    }
}
