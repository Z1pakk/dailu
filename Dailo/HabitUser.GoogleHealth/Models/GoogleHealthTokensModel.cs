namespace HabitUser.GoogleHealth.Models;

public sealed record GoogleHealthTokensModel(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAtUtc
);
