using DevHabit.Api.Database;
using DevHabit.Api.DTOs.Users;
using DevHabit.Api.Entities;
using DevHabit.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevHabit.Api.Controllers;

[Authorize(Roles = Roles.Member)]
[ApiController]
[Route("users")]
public class UsersController(ApplicationDbContext dbContext, UserContext userContext)
    : ControllerBase
{
    [HttpGet("{id}")]
    [Authorize(Roles = Roles.Admin)]
    public async Task<ActionResult<UserDto>> GetUserById(string id)
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        if (id != userId)
        {
            return NotFound("User not found.");
        }

        UserDto? user = await dbContext
            .Users.Select(UserQueries.ProjectToDto())
            .FirstOrDefaultAsync(u => u.Id == id);
        if (user is null)
        {
            return NotFound("User not found.");
        }

        return Ok(user);
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        string? userId = await userContext.GetUserIdAsync();
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized("User not found.");
        }

        UserDto? user = await dbContext
            .Users.Where(u => u.Id == userId)
            .Select(UserQueries.ProjectToDto())
            .FirstOrDefaultAsync();

        if (user is null)
        {
            return NotFound("User not found.");
        }

        return Ok(user);
    }
}
