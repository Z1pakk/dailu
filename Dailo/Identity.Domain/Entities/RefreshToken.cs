using SharedKernel.Entity;
using StrictId;

namespace Identity.Domain.Entities;

public class RefreshToken : BaseEntity<Id<RefreshToken>>
{
    public required string Token { get; set; }

    public required Guid UserId { get; set; }

    public required DateTime ExpiresAtUtc { get; set; }

    public virtual User User { get; set; } = null!;
}
