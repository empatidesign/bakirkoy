using FluentValidation;
using Nexora.Api.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Features.ParticipantSubmissions;
using Nexora.Application.Features.ParticipantSubmissions.Dtos;
using AppValidationException = Nexora.Application.Common.Exceptions.ValidationException;

namespace Nexora.Api.Endpoints.Me;

public static class MeSubmissionEndpoints
{
    public static IEndpointRouteBuilder MapMeSubmissionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/me/submissions")
            .WithTags("MeSubmissions")
            .RequireAuthorization("Citizen");

        group.MapGet("/", GetList);
        group.MapGet("/options", GetOptions);
        group.MapGet("/track/{trackingNo}", GetByTrackingNo);
        group.MapGet("/{id:guid}", GetById);
        group.MapPost("/", Create);
        // Hata raporu (docs/hata.md #4.4): düzenleme ucu hiç yoktu.
        group.MapPut("/{id:guid}", Update);
        group.MapPost("/media", UploadMedia).DisableAntiforgery();

        return app;
    }

    private static async Task<IResult> GetOptions(IParticipantSubmissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetFormOptionsAsync(ct)));

    /// <summary>Kullanıcı isteği (2026-08-28): "başvurusunun durumunu sorgulayabilir".</summary>
    private static async Task<IResult> GetById(Guid id, IParticipantSubmissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMySubmissionByIdAsync(id, ct)));

    private static async Task<IResult> GetByTrackingNo(string trackingNo, IParticipantSubmissionService service, CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMySubmissionByTrackingNoAsync(Uri.UnescapeDataString(trackingNo), ct)));

    private static async Task<IResult> UploadMedia(IFormFile file, IParticipantSubmissionService service, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new ConflictException("Lütfen bir fotoğraf veya video seçin.", "FILE_REQUIRED");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadMediaAsync(stream, file.FileName, file.ContentType, file.Length, ct);
        return Results.Ok(ApiResponse.Ok(result));
    }

    private static async Task<IResult> GetList(
        [AsParameters] CitizenSubmissionMeListParams p,
        IParticipantSubmissionService service,
        CancellationToken ct)
        => Results.Ok(ApiResponse.Ok(await service.GetMySubmissionsAsync(p, ct)));

    private static async Task<IResult> Create(
        CreateCitizenSubmissionMeRequest req,
        IValidator<CreateCitizenSubmissionMeRequest> validator,
        IParticipantSubmissionService service,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        var result = await service.CreateAsync(req, ct);
        return Results.Created($"/api/v1/me/submissions/{result.Id}", ApiResponse.Created(result));
    }

    private static async Task<IResult> Update(
        Guid id,
        UpdateCitizenSubmissionMeRequest req,
        IValidator<UpdateCitizenSubmissionMeRequest> validator,
        IParticipantSubmissionService service,
        CancellationToken ct)
    {
        var validation = await validator.ValidateAsync(req, ct);
        if (!validation.IsValid)
            throw new AppValidationException(validation);

        return Results.Ok(ApiResponse.Ok(await service.UpdateAsync(id, req, ct)));
    }
}
