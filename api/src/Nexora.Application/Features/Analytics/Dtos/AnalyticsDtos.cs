namespace Nexora.Application.Features.Analytics.Dtos;

public record AnalyticsOverviewParams
{
    public DateTime? From { get; init; }
    public DateTime? To { get; init; }
    public string? GroupBy { get; init; }
}

public record AnalyticsRangeDto(DateTime From, DateTime To, string GroupBy);

public record KpiDto(string Key, string Label, int Current, int Previous, double DeltaPct);

public record TrendPointDto(string Date, Dictionary<string, int> Values);

public record ModuleBreakdownDto(string Module, string Label, int Total, int PreviousTotal);

public record GenderSliceDto(int Male, int Female, int Unknown);

public record AgeBucketDto(string Bucket, int Count);

public record NationalityDto(int Turkish, int Foreign, int Unknown);

public record RatingDto(double Average, List<int> Distribution, int TotalReviews);

public record TopProgramDto(
    string Module,
    string Label,
    string Name,
    int Applications,
    int Capacity,
    int FillRate,
    double AvgRating,
    int ReviewCount);

public record AnalyticsOverviewDto(
    AnalyticsRangeDto Range,
    List<KpiDto> Kpis,
    List<TrendPointDto> Trend,
    List<ModuleBreakdownDto> Modules,
    GenderSliceDto Gender,
    List<AgeBucketDto> AgeBuckets,
    NationalityDto Nationality,
    RatingDto Rating,
    List<TopProgramDto> TopDemand,
    List<TopProgramDto> TopRated);
