using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Search.Application.Features.Indexing;

public static partial class SearchTextHelper
{
    /// <summary>Length of the <c>text</c> column; pass it as <c>maxLength</c> when indexing.</summary>
    public const int MaxLength = 4000;

    /// <summary>
    /// Trims, collapses whitespace runs to a single space and caps the length at
    /// <paramref name="maxLength"/>. Returns null when nothing is left, which the indexer treats
    /// as "remove from the index". Deliberately keeps case, punctuation and stop words: the same
    /// text feeds trigram matching, and anything removed here can no longer be found by typing it.
    /// </summary>
    public static string? Normalize(string? text, int maxLength)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxLength);

        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = Whitespace().Replace(text.Trim(), " ");

        if (normalized.Length <= maxLength)
        {
            return normalized;
        }

        // don't cut a surrogate pair (e.g. an emoji) in half
        var length = char.IsHighSurrogate(normalized[maxLength - 1]) ? maxLength - 1 : maxLength;

        return length == 0 ? null : normalized[..length];
    }

    /// <summary>
    /// Joins the non-empty parts (e.g. habit name and description) into one indexable text,
    /// separated by ". " so the embedding model reads them as separate sentences — whitespace
    /// alone would be collapsed by <see cref="Normalize"/>. Returns null when all parts are empty.
    /// </summary>
    public static string? Combine(params string?[] parts)
    {
        var joined = string.Join(
            ". ",
            parts.Where(p => !string.IsNullOrWhiteSpace(p)).Select(p => p!.Trim())
        );

        return joined.Length == 0 ? null : joined;
    }

    /// <summary>
    /// SHA-256 of the normalized text as 64 lowercase hex characters. Same text, same hash: lets
    /// the indexer skip the embedding call when nothing changed.
    /// </summary>
    public static string Hash(string normalizedText) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(normalizedText)));

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
