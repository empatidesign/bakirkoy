namespace Nexora.Application.Common;

public static class SemanticVersion
{
    private const int SegmentCount = 3;

    // A version string may carry one extra trailing segment (e.g. "2.5.0.1" build/hotfix
    // number) beyond the 3 semantic segments we actually compare. Anything beyond that is
    // rejected as malformed rather than silently ignored.
    private const int MaxParsableSegments = SegmentCount + 1;

    /// <summary>
    /// Returns true when <paramref name="version"/> is at most <paramref name="other"/>
    /// (i.e. version &lt;= other), comparing only the first <see cref="SegmentCount"/> segments.
    ///
    /// SECURITY: callers that gate a "must update" flow (forced webview) on this result must
    /// treat an unparseable/missing version as "at most" (true / needs update), NOT as false.
    /// This method itself fails CLOSED from a comparison standpoint (returns false when either
    /// side cannot be parsed) because "at most" cannot be proven true without both values -
    /// callers are responsible for deciding what an inconclusive comparison should mean for
    /// their own fail-open/fail-closed policy. See MobileConfigService.MatchesVersionRule.
    /// </summary>
    public static bool IsAtMost(string? version, string? other)
    {
        if (!TryParse(version, out var left) || !TryParse(other, out var right))
            return false;

        for (var i = 0; i < SegmentCount; i++)
        {
            if (left[i] != right[i])
                return left[i] < right[i];
        }

        return true;
    }

    /// <summary>
    /// Parses a version string into its first <see cref="SegmentCount"/> numeric segments.
    /// Accepts an optional leading "v"/"V" prefix (e.g. "v2.0.0"), an optional pre-release/build
    /// suffix ("-beta", "+build"), and tolerates one extra trailing segment beyond the 3 semantic
    /// segments (e.g. "2.5.0.1"), which is parsed but ignored for comparison purposes.
    /// </summary>
    public static bool TryParse(string? value, out int[] parts)
    {
        parts = [0, 0, 0];
        if (string.IsNullOrWhiteSpace(value))
            return false;

        var trimmed = value.Trim();
        if (trimmed.Length > 0 && (trimmed[0] == 'v' || trimmed[0] == 'V'))
            trimmed = trimmed[1..];

        var core = trimmed.Split('-', '+')[0];
        var segments = core.Split('.');
        if (segments.Length is 0 or > MaxParsableSegments)
            return false;

        var significantSegments = Math.Min(segments.Length, SegmentCount);
        for (var i = 0; i < significantSegments; i++)
        {
            if (!int.TryParse(segments[i], out var n) || n < 0)
                return false;
            parts[i] = n;
        }

        // Validate (but discard) any extra trailing segment so obviously garbage input like
        // "2.5.0.abc" is still rejected instead of silently accepted.
        for (var i = significantSegments; i < segments.Length; i++)
        {
            if (!int.TryParse(segments[i], out var extra) || extra < 0)
                return false;
        }

        return true;
    }
}
