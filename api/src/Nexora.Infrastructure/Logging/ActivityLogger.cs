using Microsoft.Extensions.Logging;
using Nexora.Application.Common.Interfaces;

namespace Nexora.Infrastructure.Logging;

public class ActivityLogger(ILogger<ActivityLogger> logger) : IActivityLogger
{
    private int _stepCounter;

    public void LogStep(string methodName, object? parameters = null)
        => logger.LogInformation("[STEP {N}] {Method} | params: {Params}",
            ++_stepCounter, methodName, Truncate(parameters));

    public void LogStepResult(string methodName, object? result = null)
        => logger.LogInformation("[STEP-RESULT] {Method} | result: {Result}",
            methodName, Truncate(result));

    public void LogStepError(string methodName, Exception ex)
        => logger.LogError(ex, "[STEP-ERROR] {Method} | error: {Message}", methodName, ex.Message);

    public void LogDb(string queryName, string entityName, object? filter = null)
        => logger.LogInformation("[DB {N}] {Query} | entity: {Entity} | filter: {Filter}",
            ++_stepCounter, queryName, entityName, Truncate(filter));

    public void LogDbResult(string queryName, string entityName, object? result = null)
        => logger.LogInformation("[DB-RESULT] {Query} | entity: {Entity} | result: {Result}",
            queryName, entityName, Truncate(result));

    public void LogExternal(string serviceName, string methodName, object? parameters = null)
        => logger.LogInformation("[EXTERNAL {N}] {Service}.{Method} | params: {Params}",
            ++_stepCounter, serviceName, methodName, Truncate(parameters));

    public void LogExternalResult(string serviceName, string methodName, object? result = null)
        => logger.LogInformation("[EXTERNAL-RESULT] {Service}.{Method} | result: {Result}",
            serviceName, methodName, Truncate(result));

    private static readonly System.Text.RegularExpressions.Regex SensitivePattern = new(
        @"""(password|newpassword|currentpassword|temporarypassword|secret|token|pin|tckn|authorization)""\s*:\s*""[^""]*""",
        System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);

    private static string Truncate(object? value, int maxLength = 500)
    {
        if (value is null) return "null";
        try
        {
            var str = System.Text.Json.JsonSerializer.Serialize(value);
            str = SensitivePattern.Replace(str, @"""$1"":""***""");
            return str.Length > maxLength ? str[..maxLength] + "...truncated" : str;
        }
        catch
        {
            return value.ToString() ?? "null";
        }
    }
}
