using System.Reflection;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Nexora.Infrastructure.Logging;

public class ServiceLoggingProxy<TInterface> : DispatchProxy
{
    private TInterface? _target;
    private ILogger? _logger;

    private static readonly HashSet<string> SensitiveFields =
        new(StringComparer.OrdinalIgnoreCase)
        {
            "password", "token", "refreshToken", "accessToken", "smsCode", "otpCode", "passwordHash",
            "currentPassword", "newPassword", "temporaryPassword", "tckn", "phone", "guardianPhone",
            "studentPhone", "parentPhone", "message",
        };

    private static bool IsExpectedBusinessException(Exception ex) =>
        ex is Nexora.Application.Common.Exceptions.NotFoundException
           or Nexora.Application.Common.Exceptions.ConflictException
           or Nexora.Application.Common.Exceptions.ForbiddenException
           or Nexora.Application.Common.Exceptions.ValidationException
           or Nexora.Domain.Common.DomainException;

    private void LogServiceError(Exception ex, string serviceName, string methodName, long ms)
    {
        if (IsExpectedBusinessException(ex))
            _logger?.LogDebug("[SERVICE-REJECT] {Service}.{Method} | {Ms}ms | {Message}",
                serviceName, methodName, ms, ex.Message);
        else
            _logger?.LogError(ex, "[SERVICE-ERROR] {Service}.{Method} | {Ms}ms",
                serviceName, methodName, ms);
    }

    public static TInterface Create(TInterface target, ILogger logger)
    {
        var proxy   = Create<TInterface, ServiceLoggingProxy<TInterface>>();
        var handler = (ServiceLoggingProxy<TInterface>)(object)proxy!;
        handler._target = target;
        handler._logger = logger;
        return proxy;
    }

    protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
    {
        if (targetMethod is null || _target is null)
            return null;

        var sw          = System.Diagnostics.Stopwatch.StartNew();
        var serviceName = typeof(TInterface).Name;

        if (_logger?.IsEnabled(LogLevel.Debug) == true)
            _logger.LogDebug("[SERVICE-ENTER] {Service}.{Method} | params: {Params}",
                serviceName, targetMethod.Name, Serialize(args));

        try
        {
            var result = targetMethod.Invoke(_target, args);

            if (result is Task task)
                return WrapTask(task, targetMethod.ReturnType, serviceName, targetMethod.Name, sw);

            sw.Stop();
            if (_logger?.IsEnabled(LogLevel.Debug) == true)
                _logger.LogDebug("[SERVICE-EXIT] {Service}.{Method} | {Ms}ms | result: {Result}",
                    serviceName, targetMethod.Name, sw.ElapsedMilliseconds, Serialize(result));

            return result;
        }
        catch (TargetInvocationException ex) when (ex.InnerException is not null)
        {
            sw.Stop();
            LogServiceError(ex.InnerException, serviceName, targetMethod.Name, sw.ElapsedMilliseconds);
            throw ex.InnerException;
        }
    }

    private static readonly MethodInfo s_wrapGenericMethod =
        typeof(ServiceLoggingProxy<TInterface>)
            .GetMethod(nameof(WrapGenericTaskAsync), BindingFlags.NonPublic | BindingFlags.Instance)!;

    private object WrapTask(Task task, Type returnType, string serviceName, string methodName, System.Diagnostics.Stopwatch sw)
    {
        if (returnType.IsGenericType && returnType.GetGenericTypeDefinition() == typeof(Task<>))
        {
            var resultType = returnType.GetGenericArguments()[0];
            var wrapMethod = s_wrapGenericMethod.MakeGenericMethod(resultType);
            return wrapMethod.Invoke(this, [task, serviceName, methodName, sw])!;
        }
        return WrapVoidTaskAsync(task, serviceName, methodName, sw);
    }

    private async Task WrapVoidTaskAsync(Task task, string serviceName, string methodName, System.Diagnostics.Stopwatch sw)
    {
        try
        {
            await task.ConfigureAwait(false);
            sw.Stop();
            if (_logger?.IsEnabled(LogLevel.Debug) == true)
                _logger.LogDebug("[SERVICE-EXIT] {Service}.{Method} | {Ms}ms",
                    serviceName, methodName, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            LogServiceError(ex, serviceName, methodName, sw.ElapsedMilliseconds);
            throw;
        }
    }

    private async Task<T> WrapGenericTaskAsync<T>(Task<T> task, string serviceName, string methodName, System.Diagnostics.Stopwatch sw)
    {
        try
        {
            var result = await task.ConfigureAwait(false);
            sw.Stop();
            if (_logger?.IsEnabled(LogLevel.Debug) == true)
                _logger.LogDebug("[SERVICE-EXIT] {Service}.{Method} | {Ms}ms",
                    serviceName, methodName, sw.ElapsedMilliseconds);
            return result;
        }
        catch (Exception ex)
        {
            sw.Stop();
            LogServiceError(ex, serviceName, methodName, sw.ElapsedMilliseconds);
            throw;
        }
    }

    private static string Serialize(object? value, int maxLength = 1000)
    {
        if (value is null) return "null";
        try
        {
            var json = JsonSerializer.Serialize(value, new JsonSerializerOptions { WriteIndented = false });

            foreach (var field in SensitiveFields)
            {
                json = System.Text.RegularExpressions.Regex.Replace(
                    json,
                    $@"(""{field}""\s*:\s*)""\s*[^""]*\s*""",
                    "$1\"***\"",
                    System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            }

            return json.Length > maxLength ? json[..maxLength] + "...truncated" : json;
        }
        catch
        {
            return value.ToString() ?? "null";
        }
    }
}
