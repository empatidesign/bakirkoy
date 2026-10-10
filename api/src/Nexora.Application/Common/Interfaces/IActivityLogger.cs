namespace Nexora.Application.Common.Interfaces;

public interface IActivityLogger
{
    void LogStep(string methodName, object? parameters = null);
    void LogStepResult(string methodName, object? result = null);
    void LogStepError(string methodName, Exception ex);
    void LogDb(string queryName, string entityName, object? filter = null);
    void LogDbResult(string queryName, string entityName, object? result = null);
    void LogExternal(string serviceName, string methodName, object? parameters = null);
    void LogExternalResult(string serviceName, string methodName, object? result = null);
}
