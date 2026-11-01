using System.Text;
using RabbitMQ.Client;

namespace Dailu.Infrastructure.Messaging;

public static class RabbitMqDeathHeader
{
    /// <summary>How many times the message was rejected from <paramref name="queue"/>.</summary>
    public static long GetRejectedCount(IReadOnlyBasicProperties properties, string queue)
    {
        if (
            properties.Headers?.TryGetValue("x-death", out var raw) != true
            || raw is not IEnumerable<object> deaths
        )
        {
            return 0;
        }

        foreach (var death in deaths.OfType<IDictionary<string, object?>>())
        {
            if (
                GetText(death, "queue") == queue
                && GetText(death, "reason") == "rejected"
                && death.TryGetValue("count", out var count)
                && count is long n
            )
            {
                return n;
            }
        }

        return 0;
    }

    // AMQP strings arrive as byte[] in header tables
    private static string? GetText(IDictionary<string, object?> table, string key) =>
        table.TryGetValue(key, out var value) && value is byte[] bytes
            ? Encoding.UTF8.GetString(bytes)
            : value as string;
}
