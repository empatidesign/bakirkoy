using System.Net;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Nexora.Application.Common.Interfaces;
using Nexora.Infrastructure.Services;
using Xunit;

namespace Nexora.Api.IntegrationTests.Security;

public class LibraryDoorHardwareTests
{
    [Fact]
    public async Task LibraryDoorController_WhenNoWebhookConfigured_ReturnsSuccessGracefully()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["LibraryDoor:WebhookUrl"] = null
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var clientFactory = new TestHttpClientFactory(new TestHttpMessageHandler(HttpStatusCode.OK));
        var controller = new LibraryDoorController(clientFactory, config, NullLogger<LibraryDoorController>.Instance);

        var request = new DoorTriggerRequest(
            LibraryId: Guid.NewGuid(),
            DeviceKind: "turnstile",
            Direction: "in",
            SessionId: Guid.NewGuid(),
            MemberName: "Test Vatandaş");

        var result = await controller.TriggerAsync(request);

        Assert.True(result.Opened);
    }

    [Fact]
    public async Task LibraryDoorController_WhenWebhookReturns200_ReturnsSuccess()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["LibraryDoor:WebhookUrl"] = "http://hardware.local/api/door/open",
            ["LibraryDoor:TimeoutSeconds"] = "2"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var handler = new TestHttpMessageHandler(HttpStatusCode.OK);
        var clientFactory = new TestHttpClientFactory(handler);
        var controller = new LibraryDoorController(clientFactory, config, NullLogger<LibraryDoorController>.Instance);

        var request = new DoorTriggerRequest(
            LibraryId: Guid.NewGuid(),
            DeviceKind: "turnstile",
            Direction: "in",
            SessionId: Guid.NewGuid(),
            MemberName: "Test Vatandaş");

        var result = await controller.TriggerAsync(request);

        Assert.True(result.Opened);
        Assert.NotNull(handler.LastRequest);
        Assert.Equal("http://hardware.local/api/door/open", handler.LastRequest!.RequestUri!.ToString());
    }

    [Fact]
    public async Task LibraryDoorController_WhenWebhookReturns500_ReturnsFailure()
    {
        var inMemorySettings = new Dictionary<string, string?>
        {
            ["LibraryDoor:WebhookUrl"] = "http://hardware.local/api/door/open",
            ["LibraryDoor:TimeoutSeconds"] = "2"
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var handler = new TestHttpMessageHandler(HttpStatusCode.InternalServerError);
        var clientFactory = new TestHttpClientFactory(handler);
        var controller = new LibraryDoorController(clientFactory, config, NullLogger<LibraryDoorController>.Instance);

        var request = new DoorTriggerRequest(
            LibraryId: Guid.NewGuid(),
            DeviceKind: "turnstile",
            Direction: "out",
            SessionId: Guid.NewGuid(),
            MemberName: "Test Vatandaş");

        var result = await controller.TriggerAsync(request);

        Assert.False(result.Opened);
        Assert.Equal("DOOR_TRIGGER_FAILED", result.ErrorCode);
    }

    private class TestHttpClientFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler);
    }

    private class TestHttpMessageHandler(HttpStatusCode statusCode) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new HttpResponseMessage(statusCode));
        }
    }
}
