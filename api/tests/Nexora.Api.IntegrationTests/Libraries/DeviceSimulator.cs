using System.Text;
using Microsoft.AspNetCore.Builder;

namespace Nexora.Api.IntegrationTests.Libraries;

// Task 9 binding safety ruling (c): a real, minimal, in-process HTTP listener bound ONLY to
// 127.0.0.1 on an ephemeral OS-assigned port, standing in for a physical LiderTek-protocol relay
// device during "sandbox device simulator enabled" tests. It receives the exact POST
// LibraryLockController.TriggerAsync sends and responds with a configurable status code, so the
// real outbound-HTTP code path (real HttpClient, real serialization, real timeout handling) is
// exercised end to end WITHOUT ever configuring or reaching a real physical device's IP. Plain
// HTTP is used deliberately (not HTTPS) — the target is loopback-only regardless of scheme, which
// is what makes it safe, and this avoids depending on this shared machine's dev-certificate trust
// state; the device-matrix test that consumes this simulator scopes its own host to
// LibraryLock:UseHttps=false specifically so LibraryLockController targets this listener with the
// same scheme it serves, never touching the shared factory's default HTTPS-required config used
// by every other test in this suite. Never binds to any interface other than loopback.
internal sealed class DeviceSimulator : IAsyncDisposable
{
    private readonly WebApplication _app;

    public int Port { get; }
    public string IpAddress => "127.0.0.1";
    public int RequestCount { get; private set; }
    public string? LastRequestBody { get; private set; }
    public string? LastAuthorizationHeader { get; private set; }
    public int ResponseStatus { get; set; } = 200;

    private DeviceSimulator(WebApplication app, int port)
    {
        _app = app;
        Port = port;
    }

    public static async Task<DeviceSimulator> StartAsync()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Logging.ClearProviders();
        builder.WebHost.UseKestrel(o => o.Listen(System.Net.IPAddress.Loopback, 0));
        var app = builder.Build();

        DeviceSimulator? sim = null;
        app.MapPost("/", async ctx =>
        {
            using var reader = new StreamReader(ctx.Request.Body, Encoding.UTF8);
            var body = await reader.ReadToEndAsync();
            sim!.RequestCount++;
            sim.LastRequestBody = body;
            sim.LastAuthorizationHeader = ctx.Request.Headers.Authorization.ToString();
            ctx.Response.StatusCode = sim.ResponseStatus;
        });

        await app.StartAsync();
        var address = app.Services.GetRequiredService<Microsoft.AspNetCore.Hosting.Server.IServer>()
            .Features.Get<Microsoft.AspNetCore.Hosting.Server.Features.IServerAddressesFeature>()!
            .Addresses.First();
        var port = new Uri(address).Port;

        sim = new DeviceSimulator(app, port);
        return sim;
    }

    public async ValueTask DisposeAsync() => await _app.StopAsync();
}
