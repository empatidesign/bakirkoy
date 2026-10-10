using Nexora.Infrastructure.Services.Nvi;
using Nexora.Infrastructure.Services.Scheduled;

namespace Nexora.Api.Endpoints.Dev;

public static class DevTestEndpoints
{
    public static IEndpointRouteBuilder MapDevTestEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/dev/test")
            .WithTags("Dev Test (No Auth)")
            .RequireAuthorization("AdminOrAbove")
            .RequireRateLimiting("auth");

        group.MapPost("/nvi", TestNvi);

        group.MapPost("/facility-period-expiry", async (IFacilityPeriodExpiryJob job, CancellationToken ct) =>
        {
            await job.RunAsync(ct);
            return Results.Ok(new { ran = true });
        });

        group.MapPost("/travel-expiry", async (ITravelExpiryJob job, CancellationToken ct) =>
        {
            await job.RunAsync(ct);
            return Results.Ok(new { ran = true });
        });

        group.MapPost("/travel-departure-reminder", async (ITravelDepartureReminderJob job, CancellationToken ct) =>
        {
            await job.RunAsync(ct);
            return Results.Ok(new { ran = true });
        });

        group.MapPost("/duty-pharmacy-sync", async (IDutyPharmacySyncJob job, CancellationToken ct) =>
        {
            await job.RunAsync(ct);
            return Results.Ok(new { ran = true });
        });

        group.MapPost("/participant-activity-sync", async (IParticipantActivitySyncJob job, CancellationToken ct) =>
        {
            await job.RunAsync(ct);
            return Results.Ok(new { ran = true });
        });

        return app;
    }

    private static async Task<IResult> TestNvi(
        TestNviInput input,
        NviService nviService,
        IHostEnvironment env,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(input.TcKimlik) || input.TcKimlik.Length != 11)
            return Results.BadRequest(new { error = "TcKimlik 11 haneli olmalı." });

        DateTime birthDate;
        if (input.DogumGun.HasValue && input.DogumAy.HasValue && input.DogumYil.HasValue)
        {
            try
            {
                birthDate = DateTime.SpecifyKind(
                    new DateTime(input.DogumYil.Value, input.DogumAy.Value, input.DogumGun.Value),
                    DateTimeKind.Utc);
            }
            catch (ArgumentOutOfRangeException)
            {
                return Results.BadRequest(new { error = "Geçersiz tarih." });
            }
        }
        else if (input.BirthDate.HasValue)
        {
            birthDate = input.BirthDate.Value;
        }
        else
        {
            return Results.BadRequest(new { error = "BirthDate ya da DogumGun+DogumAy+DogumYil verin." });
        }

        var yakinlikTask = nviService.DebugRawAsync(input.TcKimlik, birthDate, input.UseTestMode, input.Tur, ct);
        var adresTask = nviService.DebugAddressRawAsync(input.TcKimlik, birthDate, input.UseTestMode, input.AddressService ?? "", ct);
        await Task.WhenAll(yakinlikTask, adresTask);
        var yakinlik = await yakinlikTask;
        var adres = await adresTask;

        var includeRawXml = env.IsDevelopment();

        return Results.Ok(new
        {
            yakinlik = new
            {
                endpointUrl = yakinlik.EndpointUrl,
                httpStatusCode = yakinlik.HttpStatusCode,
                success = yakinlik.Parsed?.Success ?? false,
                errorMessage = yakinlik.ErrorMessage,
                parsed = yakinlik.Parsed,
                requestXml = includeRawXml ? yakinlik.RequestXml : null,
                responseXml = includeRawXml ? yakinlik.ResponseXml : null
            },
            adres = new
            {
                serviceName = string.IsNullOrWhiteSpace(input.AddressService) ? "KisiAdresSorgula" : input.AddressService,
                endpointUrl = adres.EndpointUrl,
                httpStatusCode = adres.HttpStatusCode,
                errorMessage = adres.ErrorMessage,
                requestXml = includeRawXml ? adres.RequestXml : null,
                responseXml = includeRawXml ? adres.ResponseXml : null
            }
        });
    }
}

public record TestNviInput(
    string TcKimlik,
    DateTime? BirthDate = null,
    int? DogumGun = null,
    int? DogumAy = null,
    int? DogumYil = null,
    bool UseTestMode = false,
    string? Tur = null,
    string? AddressService = null);
