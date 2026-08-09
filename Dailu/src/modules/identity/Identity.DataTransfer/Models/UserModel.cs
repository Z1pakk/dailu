namespace Identity.DataTransfer.Models;

public record UserModel
{
    public Guid Id { get; set; }

    public string? Email { get; set; }

    public required string FirstName { get; set; }

    public required string LastName { get; set; }
}
