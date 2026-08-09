using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Identity.Application.Configuration;
using Identity.Application.Models;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Identity.Application.Services;

public interface IAltchaService
{
    AltchaChallengeModel CreateChallenge();

    ValueTask<bool> VerifyPayloadAsync(
        string base64Payload,
        CancellationToken cancellationToken = default
    );
}

public sealed class AltchaService(IOptions<AltchaOptions> options, IMemoryCache cache)
    : IAltchaService
{
    private const int KeyLength = 32;

    public AltchaChallengeModel CreateChallenge()
    {
        var nonce = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var salt = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

        var parameters = new AltchaChallengeParameters(
            Algorithm: options.Value.Algorithm,
            Cost: options.Value.Cost,
            KeyPrefix: options.Value.KeyPrefix,
            Nonce: nonce,
            Salt: salt
        );

        var signature = ComputeHmacSha256(options.Value.HmacKey, CanonicalJson(parameters));

        return new AltchaChallengeModel(parameters, signature);
    }

    public ValueTask<bool> VerifyPayloadAsync(
        string base64Payload,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var json = Encoding.UTF8.GetString(Convert.FromBase64String(base64Payload));
            var payload = JsonSerializer.Deserialize<AltchaV3Payload>(json);

            if (payload is null)
            {
                return ValueTask.FromResult(false);
            }

            var cacheKey = $"altcha:{payload.Challenge.Signature}";
            if (cache.TryGetValue(cacheKey, out _))
            {
                return ValueTask.FromResult(false);
            }

            var p = payload.Challenge.Parameters;

            // Verify HMAC over canonical JSON of the parameters
            var reconstructed = new AltchaChallengeParameters(
                p.Algorithm,
                p.Cost,
                p.KeyPrefix,
                p.Nonce,
                p.Salt
            );
            var expectedSignature = ComputeHmacSha256(
                options.Value.HmacKey,
                CanonicalJson(reconstructed)
            );
            if (
                !CryptographicOperations.FixedTimeEquals(
                    Convert.FromHexString(expectedSignature),
                    Convert.FromHexString(payload.Challenge.Signature)
                )
            )
            {
                return ValueTask.FromResult(false);
            }

            // Verify proof-of-work: PBKDF2(nonce + BigEndian(counter), salt, cost, SHA-256, 32)
            var nonceBytes = Convert.FromHexString(p.Nonce);
            var saltBytes = Convert.FromHexString(p.Salt);
            var counterBytes = BitConverter.GetBytes((uint)payload.Solution.Counter);
            if (BitConverter.IsLittleEndian)
            {
                Array.Reverse(counterBytes);
            }

            var password = new byte[nonceBytes.Length + 4];
            Buffer.BlockCopy(nonceBytes, 0, password, 0, nonceBytes.Length);
            Buffer.BlockCopy(counterBytes, 0, password, nonceBytes.Length, 4);

            var derivedKey = Rfc2898DeriveBytes.Pbkdf2(
                password,
                saltBytes,
                p.Cost,
                HashAlgorithmName.SHA256,
                KeyLength
            );
            var derivedKeyHex = Convert.ToHexString(derivedKey).ToLowerInvariant();

            if (!derivedKeyHex.StartsWith(p.KeyPrefix, StringComparison.OrdinalIgnoreCase))
            {
                return ValueTask.FromResult(false);
            }

            cache.Set(cacheKey, true, TimeSpan.FromHours(1));

            return ValueTask.FromResult(true);
        }
        catch
        {
            return ValueTask.FromResult(false);
        }
    }

    // Matches the JavaScript lib's canonicalJSON: JSON.stringify(sortKeys(obj))
    private static string CanonicalJson(AltchaChallengeParameters p)
    {
        var sorted = new SortedDictionary<string, object>(StringComparer.Ordinal)
        {
            ["algorithm"] = p.Algorithm,
            ["cost"] = p.Cost,
            ["keyPrefix"] = p.KeyPrefix,
            ["nonce"] = p.Nonce,
            ["salt"] = p.Salt,
        };
        return JsonSerializer.Serialize(sorted);
    }

    private static string ComputeHmacSha256(string key, string data)
    {
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(key), Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

internal sealed class AltchaV3Payload
{
    [JsonPropertyName("challenge")]
    public AltchaV3ChallengePart Challenge { get; init; } = new();

    [JsonPropertyName("solution")]
    public AltchaV3Solution Solution { get; init; } = new();
}

internal sealed class AltchaV3ChallengePart
{
    [JsonPropertyName("parameters")]
    public AltchaV3Parameters Parameters { get; init; } = new();

    [JsonPropertyName("signature")]
    public string Signature { get; init; } = string.Empty;
}

internal sealed class AltchaV3Parameters
{
    [JsonPropertyName("algorithm")]
    public string Algorithm { get; init; } = string.Empty;

    [JsonPropertyName("cost")]
    public int Cost { get; init; }

    [JsonPropertyName("keyPrefix")]
    public string KeyPrefix { get; init; } = string.Empty;

    [JsonPropertyName("nonce")]
    public string Nonce { get; init; } = string.Empty;

    [JsonPropertyName("salt")]
    public string Salt { get; init; } = string.Empty;
}

internal sealed class AltchaV3Solution
{
    [JsonPropertyName("counter")]
    public int Counter { get; init; }

    [JsonPropertyName("derivedKey")]
    public string DerivedKey { get; init; } = string.Empty;
}
