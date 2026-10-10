using Microsoft.AspNetCore.Http;
using Nexora.Api.Common.Middleware;
using Nexora.Infrastructure.Security;
using Xunit;

namespace Nexora.Api.IntegrationTests.Security;

public class SecurityHardeningTests
{
    [Fact]
    public void TimingSafeAuth_ReturnsTrueForValidPassword()
    {
        var password = "SuperSecretPassword123!";
        var hash = BCrypt.Net.BCrypt.HashPassword(password, 10);

        var result = TimingSafeAuth.Verify(password, hash);

        Assert.True(result);
    }

    [Fact]
    public void TimingSafeAuth_ReturnsFalseForInvalidPassword()
    {
        var password = "SuperSecretPassword123!";
        var hash = BCrypt.Net.BCrypt.HashPassword(password, 10);

        var result = TimingSafeAuth.Verify("WrongPassword!", hash);

        Assert.False(result);
    }

    [Fact]
    public void TimingSafeAuth_ReturnsFalseAndExecutesDummyForNullHash()
    {
        var result = TimingSafeAuth.Verify("AnyPassword123!", null);

        Assert.False(result);
    }

    [Fact]
    public void PasswordGenerator_GeneratesRandomPasswordsWhenMockIsFalse()
    {
        var pwd1 = PasswordGenerator.Generate(8, useMock: false);
        var pwd2 = PasswordGenerator.Generate(8, useMock: false);

        Assert.NotEqual("sultangazi", pwd1);
        Assert.NotEqual("sultangazi", pwd2);
        Assert.Equal(8, pwd1.Length);
        Assert.Equal(8, pwd2.Length);
    }

    [Fact]
    public async Task SecurityHeadersMiddleware_AppliesExpectedHeaders()
    {
        var context = new DefaultHttpContext();
        context.Request.Path = "/api/v1/events";

        var middleware = new SecurityHeadersMiddleware(next: (ctx) => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        Assert.Equal("nosniff", context.Response.Headers["X-Content-Type-Options"].ToString());
        Assert.Equal("DENY", context.Response.Headers["X-Frame-Options"].ToString());
        Assert.Equal("strict-origin-when-cross-origin", context.Response.Headers["Referrer-Policy"].ToString());
        Assert.Equal("0", context.Response.Headers["X-XSS-Protection"].ToString());
        Assert.Equal("camera=(), microphone=(), geolocation=()", context.Response.Headers["Permissions-Policy"].ToString());
    }

    [Fact]
    public void ActivityLogger_RedactsSensitiveInformation()
    {
        var testLogger = new TestLogger<Nexora.Infrastructure.Logging.ActivityLogger>();
        var activityLogger = new Nexora.Infrastructure.Logging.ActivityLogger(testLogger);

        activityLogger.LogStep("TestAuth", new
        {
            Email = "admin@nexora.local",
            Password = "MySecretPassword123",
            Token = "secret-token-abc",
            Tckn = "12345678901"
        });

        var logMessage = testLogger.LastMessage;
        Assert.DoesNotContain("MySecretPassword123", logMessage);
        Assert.DoesNotContain("secret-token-abc", logMessage);
        Assert.DoesNotContain("12345678901", logMessage);
        Assert.Contains("***", logMessage);
    }

    private class TestLogger<T> : Microsoft.Extensions.Logging.ILogger<T>
    {
        public string LastMessage { get; private set; } = string.Empty;

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(Microsoft.Extensions.Logging.LogLevel logLevel) => true;

        public void Log<TState>(
            Microsoft.Extensions.Logging.LogLevel logLevel,
            Microsoft.Extensions.Logging.EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            LastMessage = formatter(state, exception);
        }
    }
}
