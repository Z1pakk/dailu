using System.Text.Json.Serialization;

namespace Identity.Application.Models;

public sealed record AltchaChallengeModel(
    [property: JsonPropertyName("parameters")] AltchaChallengeParameters Parameters,
    [property: JsonPropertyName("signature")] string Signature
);

public sealed record AltchaChallengeParameters(
    [property: JsonPropertyName("algorithm")] string Algorithm,
    [property: JsonPropertyName("cost")] int Cost,
    [property: JsonPropertyName("keyPrefix")] string KeyPrefix,
    [property: JsonPropertyName("nonce")] string Nonce,
    [property: JsonPropertyName("salt")] string Salt
);
