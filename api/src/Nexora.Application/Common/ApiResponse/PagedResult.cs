namespace Nexora.Application.Common.ApiResponse;

public class PagedResult<T>
{
    public List<T> Items { get; init; } = [];
    public int Total { get; init; }
    public int Page { get; init; }
    public int Limit { get; init; }
    public int TotalPages => (int)Math.Ceiling((double)Total / Limit);
}
