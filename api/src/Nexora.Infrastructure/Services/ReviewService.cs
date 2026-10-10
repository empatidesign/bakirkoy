using Microsoft.Extensions.Configuration;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Loyalty;
using Nexora.Application.Features.Loyalty.Requests;
using Nexora.Application.Features.Reviews;
using Nexora.Application.Features.Reviews.Dtos;
using Nexora.Domain.Entities.Reviews;

namespace Nexora.Infrastructure.Services;

public class ReviewService(IUnitOfWork uow, ICurrentUser currentUser, IConfiguration config, ILoyaltyService loyalty) : IReviewService
{
    private int EventWindowDays => config.GetValue("ReviewSettings:EventWindowDays", 14);
    private int TravelWindowDays => config.GetValue("ReviewSettings:TravelWindowDays", 14);

    public async Task<CitizenReviewsDto> GetEventReviewsAsync(Guid eventId, CancellationToken ct)
    {
        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var reviews = await uow.EventReviews.GetByEventIdAsync(eventId, ct);

        var now = DateTime.UtcNow;
        var eventEnded = ev.EndDate < now;
        var withinWindow = eventEnded && (now - ev.EndDate).TotalDays <= EventWindowDays;

        var canReview = false;
        var alreadyReviewed = false;
        var checkedIn = false;

        if (currentUser.Id.HasValue)
        {
            var pid = currentUser.Id.Value;
            checkedIn = await uow.EventActivities.HasCheckedInAsync(eventId, pid, ct);
            alreadyReviewed = await uow.EventReviews.ExistsByParticipantAsync(eventId, pid, ct);
            if (!alreadyReviewed && eventEnded && withinWindow && checkedIn)
                canReview = true;
        }

        var dtos = reviews.Select(r => new CitizenReviewDto(r.Id, r.Rating, r.Comment, r.CreatedAt)).ToList();
        double? avg = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : null;
        return new CitizenReviewsDto(dtos, canReview, alreadyReviewed, checkedIn, avg, reviews.Count, EventWindowDays);
    }

    public async Task<CitizenReviewDto> SubmitEventReviewAsync(Guid eventId, SubmitReviewRequest req, CancellationToken ct)
    {
        var pid = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        if (await uow.Participants.GetByIdAsync(pid, ct) is null)
            throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var ev = await uow.Events.GetByIdAsync(eventId, ct)
            ?? throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        ValidateRating(req.Rating);

        var now = DateTime.UtcNow;
        if (ev.EndDate >= now)
            throw new ConflictException("Etkinlik henüz tamamlanmadı. Değerlendirme etkinlik bittikten sonra yapılabilir.", "EVENT_NOT_ENDED");

        if ((now - ev.EndDate).TotalDays > EventWindowDays)
            throw new ConflictException($"Değerlendirme süresi doldu. Etkinlik bitişinden itibaren {EventWindowDays} gün içinde yapılabilir.", "REVIEW_WINDOW_CLOSED");

        var checkedIn = await uow.EventActivities.HasCheckedInAsync(eventId, pid, ct);
        if (!checkedIn)
            throw new ForbiddenException("Bu etkinliğe katılım sağlamadığınız için değerlendirme yapamazsınız.", "NOT_CHECKED_IN");

        if (await uow.EventReviews.ExistsByParticipantAsync(eventId, pid, ct))
            throw new ConflictException("Bu etkinliği zaten değerlendirdiniz.", "ALREADY_REVIEWED");

        var review = EventReview.Create(eventId, pid, req.Rating, req.Comment);
        await uow.EventReviews.AddAsync(review, ct);
        await uow.SaveChangesAsync(ct);

        await loyalty.AwardPointsAsync(new AwardPointsRequest(pid, "event_review", review.Id.ToString()), ct);

        return new CitizenReviewDto(review.Id, review.Rating, review.Comment, review.CreatedAt);
    }

    public async Task<CitizenReviewsDto> GetTravelReviewsAsync(Guid travelId, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var reviews = await uow.TravelReviews.GetByTravelIdAsync(travelId, ct);

        var now = DateTime.UtcNow;
        var travelEnded = travel.EndDate < now;
        var withinWindow = travelEnded && (now - travel.EndDate).TotalDays <= TravelWindowDays;

        var canReview = false;
        var alreadyReviewed = false;
        var hasApproved = false;

        if (currentUser.Id.HasValue)
        {
            var pid = currentUser.Id.Value;
            alreadyReviewed = await uow.TravelReviews.ExistsByParticipantAsync(travelId, pid, ct);
            hasApproved = await uow.TravelApplications.AnyAsync(
                a => a.TravelId == travelId && a.ParticipantId == pid && a.Status == "approved", ct);
            if (!alreadyReviewed && travelEnded && withinWindow && hasApproved)
                canReview = true;
        }

        var dtos = reviews.Select(r => new CitizenReviewDto(r.Id, r.Rating, r.Comment, r.CreatedAt)).ToList();
        double? avg = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : null;
        return new CitizenReviewsDto(dtos, canReview, alreadyReviewed, hasApproved, avg, reviews.Count, TravelWindowDays);
    }

    public async Task<CitizenReviewDto> SubmitTravelReviewAsync(Guid travelId, SubmitReviewRequest req, CancellationToken ct)
    {
        var pid = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmalısınız.", "NOT_AUTHENTICATED");

        if (await uow.Participants.GetByIdAsync(pid, ct) is null)
            throw new NotFoundException("Vatandaş kaydı bulunamadı.", "PARTICIPANT_NOT_FOUND");

        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        ValidateRating(req.Rating);

        var now = DateTime.UtcNow;
        if (travel.EndDate >= now)
            throw new ConflictException("Gezi henüz tamamlanmadı. Değerlendirme gezi bittikten sonra yapılabilir.", "TRAVEL_NOT_ENDED");

        if ((now - travel.EndDate).TotalDays > TravelWindowDays)
            throw new ConflictException($"Değerlendirme süresi doldu. Gezi bitişinden itibaren {TravelWindowDays} gün içinde yapılabilir.", "REVIEW_WINDOW_CLOSED");

        var hasApproved = await uow.TravelApplications.AnyAsync(
            a => a.TravelId == travelId && a.ParticipantId == pid && a.Status == "approved", ct);
        if (!hasApproved)
            throw new ForbiddenException("Bu geziyi değerlendirmek için onaylı başvurunuz olması gerekir.", "NOT_ELIGIBLE");

        if (await uow.TravelReviews.ExistsByParticipantAsync(travelId, pid, ct))
            throw new ConflictException("Bu geziyi zaten değerlendirdiniz.", "ALREADY_REVIEWED");

        var review = TravelReview.Create(travelId, pid, req.Rating, req.Comment);
        await uow.TravelReviews.AddAsync(review, ct);
        await uow.SaveChangesAsync(ct);

        await loyalty.AwardPointsAsync(new AwardPointsRequest(pid, "travel_review", review.Id.ToString()), ct);

        return new CitizenReviewDto(review.Id, review.Rating, review.Comment, review.CreatedAt);
    }

    public async Task<AdminReviewsDto> GetEventReviewsAdminAsync(Guid eventId, CancellationToken ct)
    {
        if (await uow.Events.GetByIdAsync(eventId, ct) is null)
            throw new NotFoundException("Etkinlik bulunamadı.", "EVENT_NOT_FOUND");

        var reviews = await uow.EventReviews.GetByEventIdAsync(eventId, ct);
        var nameMap = await BuildNameMapAsync(reviews.Select(r => r.ParticipantId).ToList(), ct);

        var dtos = reviews.Select(r => new AdminReviewDto(
            r.Id,
            nameMap.TryGetValue(r.ParticipantId, out var n) ? n : "Vatandaş",
            r.Rating, r.Comment, r.CreatedAt)).ToList();

        double? avg = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : null;
        return new AdminReviewsDto(dtos, avg, reviews.Count);
    }

    public async Task<AdminReviewsDto> GetTravelReviewsAdminAsync(Guid travelId, CancellationToken ct)
    {
        if (await uow.Travels.GetByIdAsync(travelId, ct) is null)
            throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var reviews = await uow.TravelReviews.GetByTravelIdAsync(travelId, ct);
        var nameMap = await BuildNameMapAsync(reviews.Select(r => r.ParticipantId).ToList(), ct);

        var dtos = reviews.Select(r => new AdminReviewDto(
            r.Id,
            nameMap.TryGetValue(r.ParticipantId, out var n) ? n : "Vatandaş",
            r.Rating, r.Comment, r.CreatedAt)).ToList();

        double? avg = reviews.Count > 0 ? Math.Round(reviews.Average(r => r.Rating), 1) : null;
        return new AdminReviewsDto(dtos, avg, reviews.Count);
    }

    private async Task<Dictionary<Guid, string>> BuildNameMapAsync(List<Guid> participantIds, CancellationToken ct)
    {
        if (participantIds.Count == 0) return [];
        var participants = await uow.Participants.FindAsync(p => participantIds.Contains(p.Id), ct);
        return participants.ToDictionary(p => p.Id, p => p.FullName);
    }

    private static void ValidateRating(int rating)
    {
        if (rating < 1 || rating > 5)
            throw new ConflictException("Puan 1 ile 5 arasında olmalıdır.", "INVALID_RATING");
    }
}
