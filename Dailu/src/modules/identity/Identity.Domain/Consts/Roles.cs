namespace Identity.Domain.Consts;

public static class Roles
{
    public const string Admin = nameof(Admin);
    public const string Member = nameof(Member);

    public static readonly IReadOnlySet<string> All = new HashSet<string> { Admin, Member };
}
