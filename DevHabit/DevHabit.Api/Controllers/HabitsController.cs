using System.Dynamic;
using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Common;
using DevHabit.Api.DTOs.Habits;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using DevHabit.Api.Services.Sorting;
using FluentValidation;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[ApiController]
[Route("habits")]
public class HabitsController(ApplicationDbContext dbContext, LinkService linkService)
    : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHabits(
        [FromQuery] HabitsQueryParameters queryParams,
        [FromServices] SortMappingProvider sortMappingProvider,
        [FromServices] DataShapingService dataShapingService
    )
    {
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
            .ApplySort(queryParams.Sort, sortMappings)
            .Select(HabitQueries.ProjectToDto());

        int totalCount = await habitsQuery.CountAsync();

        List<HabitDto> habits = await habitsQuery
            .Skip((queryParams.Page - 1) * queryParams.PageSize)
            .Take(queryParams.PageSize)
            .ToListAsync();

        bool isLinksIncluded =
            queryParams.AcceptHeader == CustomMediaTypeNames.Application.HateoasJson;

        var paginationResult = new PaginationResult<ExpandoObject>()
        {
            Items = dataShapingService.ShapeCollectionData(
                habits,
                queryParams.Fields,
                isLinksIncluded ? h => CreateLinksForHabit(h.Id, queryParams.Fields) : null
            ),
            Page = queryParams.Page,
            PageSize = queryParams.PageSize,
            TotalCount = totalCount,
        };
        if (isLinksIncluded)
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
    public async Task<IActionResult> GetHabit(
        [FromRoute] string id,
        [FromQuery] string? fields,
        [FromHeader(Name = "Accept")] string acceptHeader,
        [FromServices] DataShapingService dataShapingService
    )
    {
        if (!dataShapingService.Validate<HabitWithTagsDto>(fields))
        {
            return Problem(
                detail: $"The fields parameter is invalid: {fields}",
                statusCode: StatusCodes.Status400BadRequest
            );
        }

        HabitWithTagsDto? habitDto = await dbContext
            .Habits.Select(HabitQueries.ProjectToDtoWithTags())
            .FirstOrDefaultAsync(h => h.Id == id);

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
        await validator.ValidateAndThrowAsync(createHabitDto);

        Habit habit = createHabitDto.ToEntity();

        dbContext.Habits.Add(habit);
        await dbContext.SaveChangesAsync();

        HabitDto habitDto = habit.ToDto();

        habitDto.Links = CreateLinksForHabit(habit.Id, null);

        return CreatedAtAction(nameof(GetHabit), new { id = habit.Id }, habitDto);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateHabit(string id, [FromBody] UpdateHabitDto updateHabitDto)
    {
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);

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
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);
        if (habit is null)
        {
            return NotFound();
        }

        HabitDto habitDto = habit.ToDto();

        patchDocument.ApplyTo(habitDto, ModelState);

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
        Habit? habit = await dbContext.Habits.FirstOrDefaultAsync(h => h.Id == id);

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
