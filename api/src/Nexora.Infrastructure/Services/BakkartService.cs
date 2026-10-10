using System.Security.Cryptography;
using System.Text;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Bakkart;
using Nexora.Application.Features.Bakkart.Dtos;
using Nexora.Domain.Entities.Bakkart;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class BakkartService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    IApiKeyEncryptor encryptor,
    IFileStorageService fileStorage,
    IMalwareScanService malwareScan,
    INotificationDispatcher dispatcher,
    Nexora.Application.Features.Notifications.INotificationService notificationService) : IBakkartService
{
    private const string Module = "Bakkart";
    private const string DocumentsBucket = "nexora-private";

    private static string HashTckn(string tckn)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(tckn.Trim())));

    private static BakkartCardType ParseCardType(string value)
        => Enum.TryParse<BakkartCardType>(value, true, out var t)
            ? t
            : throw new Nexora.Application.Common.Exceptions.ValidationException(
                "Geçersiz kart tipi.", new Dictionary<string, string[]> { ["cardType"] = ["Geçersiz kart tipi."] });

    private static BakkartDeliveryType ParseDeliveryType(string value)
        => Enum.TryParse<BakkartDeliveryType>(value, true, out var t)
            ? t
            : throw new Nexora.Application.Common.Exceptions.ValidationException(
                "Geçersiz teslimat tipi.", new Dictionary<string, string[]> { ["deliveryType"] = ["Geçersiz teslimat tipi."] });

    private BakkartApplicationDto MapDto(BakkartApplication a, BakkartCard? card)
    {
        var fullName = encryptor.Decrypt(a.EncryptedFullName) ?? "";
        var tckn = encryptor.Decrypt(a.EncryptedTckn) ?? "";
        var phone = encryptor.Decrypt(a.EncryptedPhone) ?? "";
        var documents = string.IsNullOrWhiteSpace(a.DocumentsJson)
            ? []
            : System.Text.Json.JsonSerializer.Deserialize<List<BakkartDocumentDto>>(a.DocumentsJson) ?? [];

        return new BakkartApplicationDto(
            a.Id,
            a.TrackingNo,
            a.ParticipantId,
            fullName,
            tckn,
            a.TcknLast4,
            phone,
            a.District,
            a.CardType.ToString(),
            a.DeliveryType.ToString(),
            a.Status.ToString(),
            documents,
            a.AppliedAt,
            a.ReviewedBy,
            a.ReviewedAt,
            a.RejectReason,
            a.Notes,
            card?.Id,
            card?.CardNo,
            card?.Balance,
            card?.Points,
            card?.Status.ToString());
    }

    private static BakkartCardDto MapCardDto(BakkartCard card, string holderName, string tcknLast4, string phone, string district)
        => new(
            card.Id,
            card.ApplicationId,
            card.CardNo,
            card.CardType.ToString(),
            card.Status.ToString(),
            card.Balance,
            card.Points,
            card.IssuedAt,
            holderName,
            tcknLast4,
            phone,
            district);

    private static BakkartTransactionDto MapTransactionDto(BakkartTransaction t)
        => new(t.Id, t.Type.ToString(), t.AmountDelta, t.PointsDelta, t.BalanceAfter, t.PointsAfter, t.Description, t.PerformedBy, t.OccurredAt);

    public async Task<PagedResult<BakkartApplicationDto>> GetPagedAsync(BakkartApplicationListParams p, CancellationToken ct)
    {
        var paged = await uow.BakkartApplications.GetPagedAsync(p, ct);
        var cards = await uow.BakkartCards.GetByApplicationIdsAsync(paged.Items.Select(a => a.Id), ct);
        var cardsById = cards.ToDictionary(c => c.ApplicationId, c => c);

        var items = paged.Items
            .Select(a => MapDto(a, cardsById.GetValueOrDefault(a.Id)))
            .ToList();

        return new PagedResult<BakkartApplicationDto>
        {
            Items = items,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<BakkartApplicationSummaryDto> GetSummaryAsync(CancellationToken ct)
        => await uow.BakkartApplications.GetSummaryAsync(ct);

    public async Task<BakkartApplicationDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.BakkartApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bakkart başvurusu bulunamadı.", "BAKKART_APPLICATION_NOT_FOUND");
        var card = await uow.BakkartCards.GetByApplicationIdAsync(id, ct);
        return MapDto(app, card);
    }

    private async Task<BakkartCard> IssueCardAsync(BakkartApplication app, CancellationToken ct)
    {
        var cardNumber = await uow.BakkartCards.NextCardNumberAsync(ct);
        var cardNo = $"BKK-{DateTime.UtcNow:yyyy}-{cardNumber:D6}";
        var card = BakkartCard.Create(app.Id, app.ParticipantId, cardNo, app.CardType);
        await uow.BakkartCards.AddAsync(card, ct);
        return card;
    }

    public async Task<BakkartApplicationDto> AdminCreateAsync(AdminCreateBakkartApplicationRequest req, CancellationToken ct)
    {
        var tckn = req.Tckn.Trim();
        var tcknHash = HashTckn(tckn);

        if (await uow.BakkartApplications.ExistsActiveByTcknHashAsync(tcknHash, ct))
            throw new ConflictException("Bu T.C. kimlik numarasına kayıtlı aktif bir Bakkart başvurusu zaten var.", "BAKKART_ALREADY_APPLIED");

        var participant = await uow.Participants.GetByTcknAsync(tckn, ct);

        var trackingNumber = await uow.BakkartApplications.NextTrackingNumberAsync(ct);
        var trackingNo = $"BKK-{DateTime.UtcNow:yyyy}-{trackingNumber:D4}";

        var app = BakkartApplication.Create(
            participant?.Id,
            trackingNo,
            encryptor.Encrypt(req.FullName.Trim()),
            encryptor.Encrypt(tckn),
            tcknHash,
            tckn[^4..],
            encryptor.Encrypt(req.Phone.Trim()),
            req.Phone.Trim().Length >= 4 ? req.Phone.Trim()[^4..] : req.Phone.Trim(),
            req.District,
            ParseCardType(req.CardType),
            BakkartDeliveryType.Digital,
            "[]",
            "Belediye santral/masa üzerinden anında tanımlandı.");

        await uow.BakkartApplications.AddAsync(app, ct);
        await uow.SaveChangesAsync(ct);

        var card = await IssueCardAsync(app, ct);
        app.Approve(currentUser.Name, card.Id);
        uow.BakkartApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "BakkartApplication",
            EntityId = app.Id,
            Module = Module,
            Description = $"Bakkart başvurusu manuel oluşturuldu ve onaylandı: {trackingNo}",
        }, ct);

        return MapDto(app, card);
    }

    public async Task<BakkartApplicationDto> ApproveAsync(Guid id, CancellationToken ct)
    {
        var app = await uow.BakkartApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bakkart başvurusu bulunamadı.", "BAKKART_APPLICATION_NOT_FOUND");

        if (app.Status != BakkartApplicationStatus.Pending)
            throw new ConflictException("Bu başvuru zaten işleme alınmış.", "BAKKART_APPLICATION_NOT_PENDING");

        var card = await IssueCardAsync(app, ct);
        app.Approve(currentUser.Name, card.Id);
        uow.BakkartApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        var phone = encryptor.Decrypt(app.EncryptedPhone);
        if (!string.IsNullOrWhiteSpace(phone))
            await dispatcher.SendSmsAsync(phone, $"Bakkart başvurunuz ({app.TrackingNo}) onaylandı. Kartınız dijital olarak aktif edildi.", ct);

        if (app.ParticipantId.HasValue)
            await notificationService.CreateAsync(app.ParticipantId.Value, "Bakkart Onaylandı",
                $"Bakkart başvurunuz onaylandı. Kart no: {card.CardNo}", "bakkart", ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Approve,
            EntityType = "BakkartApplication",
            EntityId = app.Id,
            Module = Module,
            Description = $"Bakkart başvurusu onaylandı: {app.TrackingNo}",
        }, ct);

        return MapDto(app, card);
    }

    public async Task<BakkartApplicationDto> RejectAsync(Guid id, RejectBakkartApplicationRequest req, CancellationToken ct)
    {
        var app = await uow.BakkartApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bakkart başvurusu bulunamadı.", "BAKKART_APPLICATION_NOT_FOUND");

        if (app.Status != BakkartApplicationStatus.Pending)
            throw new ConflictException("Bu başvuru zaten işleme alınmış.", "BAKKART_APPLICATION_NOT_PENDING");

        app.Reject(req.Reason, currentUser.Name);
        uow.BakkartApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        var phone = encryptor.Decrypt(app.EncryptedPhone);
        if (!string.IsNullOrWhiteSpace(phone))
            await dispatcher.SendSmsAsync(phone,
                $"Bakkart başvurunuz ({app.TrackingNo}) reddedildi.{(string.IsNullOrWhiteSpace(req.Reason) ? "" : $" Sebep: {req.Reason}")}", ct);

        if (app.ParticipantId.HasValue)
            await notificationService.CreateAsync(app.ParticipantId.Value, "Bakkart Başvurusu Reddedildi",
                req.Reason ?? "Başvurunuz reddedildi.", "bakkart", ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Reject,
            EntityType = "BakkartApplication",
            EntityId = app.Id,
            Module = Module,
            Description = $"Bakkart başvurusu reddedildi: {app.TrackingNo}",
        }, ct);

        return MapDto(app, null);
    }

    public async Task<BakkartApplicationDto> UpdateDocumentsAsync(Guid id, UpdateBakkartDocumentsRequest req, CancellationToken ct)
    {
        var app = await uow.BakkartApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bakkart başvurusu bulunamadı.", "BAKKART_APPLICATION_NOT_FOUND");

        app.UpdateDocuments(System.Text.Json.JsonSerializer.Serialize(req.Documents));
        uow.BakkartApplications.Update(app);
        await uow.SaveChangesAsync(ct);

        var card = await uow.BakkartCards.GetByApplicationIdAsync(app.Id, ct);
        return MapDto(app, card);
    }

    public async Task<BakkartCardDto> AdjustCardAsync(Guid cardId, AdjustBakkartCardRequest req, CancellationToken ct)
    {
        var card = await uow.BakkartCards.GetByIdAsync(cardId, ct)
            ?? throw new NotFoundException("Bakkart bulunamadı.", "BAKKART_CARD_NOT_FOUND");
        var app = await uow.BakkartApplications.GetByIdAsync(card.ApplicationId, ct);

        if (req.BalanceDelta is { } balanceDelta && balanceDelta != 0)
        {
            card.AdjustBalance(balanceDelta);
            var txType = balanceDelta > 0 ? BakkartTransactionType.BalanceLoad : BakkartTransactionType.BalanceSpend;
            await uow.BakkartTransactions.AddAsync(
                BakkartTransaction.Create(card.Id, txType, balanceDelta, 0, card.Balance, card.Points, req.Note, currentUser.Name), ct);
        }

        if (req.PointsDelta is { } pointsDelta && pointsDelta != 0)
        {
            card.AdjustPoints(pointsDelta);
            var txType = pointsDelta > 0 ? BakkartTransactionType.PointsEarn : BakkartTransactionType.PointsSpend;
            await uow.BakkartTransactions.AddAsync(
                BakkartTransaction.Create(card.Id, txType, 0, pointsDelta, card.Balance, card.Points, req.Note, currentUser.Name), ct);
        }

        uow.BakkartCards.Update(card);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "BakkartCard",
            EntityId = card.Id,
            Module = Module,
            Description = $"Bakkart bakiye/puan güncellendi: {card.CardNo} (bakiye {card.Balance:F2} ₺, puan {card.Points})",
        }, ct);

        var holderName = app is not null ? encryptor.Decrypt(app.EncryptedFullName) ?? "" : "";
        var phone = app is not null ? encryptor.Decrypt(app.EncryptedPhone) ?? "" : "";
        var district = app?.District ?? "";
        var tcknLast4 = app?.TcknLast4 ?? "";
        return MapCardDto(card, holderName, tcknLast4, phone, district);
    }

    public async Task<List<BakkartTransactionDto>> GetCardTransactionsAsync(Guid cardId, CancellationToken ct)
    {
        var transactions = await uow.BakkartTransactions.GetByCardIdAsync(cardId, 200, ct);
        return transactions.Select(MapTransactionDto).ToList();
    }

    public async Task<BakkartCardStatsDto> GetCardStatsAsync(Guid cardId, CancellationToken ct)
        => await uow.BakkartTransactions.GetStatsAsync(cardId, ct);

    public async Task<BakkartApplicationDto> CitizenApplyAsync(CreateBakkartApplicationRequest req, CancellationToken ct)
    {
        var tckn = req.Tckn.Trim();
        var tcknHash = HashTckn(tckn);

        if (await uow.BakkartApplications.ExistsActiveByTcknHashAsync(tcknHash, ct))
            throw new ConflictException("Bu T.C. kimlik numarasına kayıtlı aktif bir Bakkart başvurusu zaten var.", "BAKKART_ALREADY_APPLIED");

        Guid? participantId = currentUser.Id;

        var trackingNumber = await uow.BakkartApplications.NextTrackingNumberAsync(ct);
        var trackingNo = $"BKK-{DateTime.UtcNow:yyyy}-{trackingNumber:D4}";

        var documentsJson = req.Documents is { Count: > 0 }
            ? System.Text.Json.JsonSerializer.Serialize(req.Documents)
            : "[]";

        var phoneTrim = req.Phone.Trim();
        var app = BakkartApplication.Create(
            participantId,
            trackingNo,
            encryptor.Encrypt(req.FullName.Trim()),
            encryptor.Encrypt(tckn),
            tcknHash,
            tckn[^4..],
            encryptor.Encrypt(phoneTrim),
            phoneTrim.Length >= 4 ? phoneTrim[^4..] : phoneTrim,
            req.District,
            ParseCardType(req.CardType),
            ParseDeliveryType(req.DeliveryType),
            documentsJson,
            req.Notes);

        await uow.BakkartApplications.AddAsync(app, ct);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "BakkartApplication",
            EntityId = app.Id,
            Module = Module,
            Description = $"Vatandaş Bakkart başvurusu: {trackingNo}",
        }, ct);

        return MapDto(app, null);
    }

    public async Task<BakkartDocumentDto> UploadMyDocumentAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var participantId = currentUser.Id
            ?? throw new ForbiddenException("Bu işlem için giriş yapmanız gerekiyor.", "NOT_AUTHENTICATED");

        Nexora.Application.Common.SafeUploadValidation.EnsureSafeDocument(fileName, contentType);

        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);
        var rawBytes = buffer.ToArray();
        if (rawBytes.Length == 0)
            throw new ConflictException("Yüklenen dosya boş.", "FILE_REQUIRED");

        Nexora.Application.Common.FileSignatureValidator.EnsureValidDocumentFormat(rawBytes, null);

        buffer.Position = 0;
        var scanResult = await malwareScan.ScanAsync(buffer, fileName, ct);
        if (!scanResult.IsClean)
            throw new ConflictException(
                "Bu dosya güvenlik taramasından geçemedi ve yüklenemedi. Lütfen dosyanızı kontrol edip tekrar deneyin.",
                "MALWARE_DETECTED");

        buffer.Position = 0;
        var (optimizedStream, optimizedFileName, optimizedContentType, ownsStream) =
            await Nexora.Infrastructure.Services.WebpImageConverter.ConvertAsync(buffer, fileName, contentType, ct);

        var keyPrefix = $"bakkart/{participantId}";
        var upload = await fileStorage.UploadAsync(optimizedStream, optimizedFileName, optimizedContentType, DocumentsBucket, ct, keyPrefix: keyPrefix);
        if (ownsStream) await optimizedStream.DisposeAsync();

        return new BakkartDocumentDto(fileName, FileUrl.Private(upload.ObjectName));
    }

    public async Task<MyBakkartStatusDto> GetMyStatusAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid participantId)
            return new MyBakkartStatusDto(null, null, null, null, null);

        var applications = await uow.BakkartApplications.GetByParticipantIdAsync(participantId, ct);
        var latest = applications.FirstOrDefault();
        if (latest is null)
            return new MyBakkartStatusDto(null, null, null, null, null);

        BakkartCardDto? cardDto = null;
        if (latest.Status == BakkartApplicationStatus.Approved)
        {
            var card = await uow.BakkartCards.GetByApplicationIdAsync(latest.Id, ct);
            if (card is not null)
            {
                var holderName = encryptor.Decrypt(latest.EncryptedFullName) ?? "";
                var phone = encryptor.Decrypt(latest.EncryptedPhone) ?? "";
                cardDto = MapCardDto(card, holderName, latest.TcknLast4, phone, latest.District);
            }
        }

        return new MyBakkartStatusDto(latest.TrackingNo, latest.Status.ToString(), latest.AppliedAt, latest.RejectReason, cardDto);
    }

    public async Task<BakkartCardStatsDto?> GetMyStatsAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid participantId) return null;
        var card = await uow.BakkartCards.GetByParticipantIdAsync(participantId, ct);
        if (card is null) return null;
        return await uow.BakkartTransactions.GetStatsAsync(card.Id, ct);
    }

    public async Task<List<BakkartTransactionDto>> GetMyTransactionsAsync(CancellationToken ct)
    {
        if (currentUser.Id is not Guid participantId) return [];
        var card = await uow.BakkartCards.GetByParticipantIdAsync(participantId, ct);
        if (card is null) return [];
        var transactions = await uow.BakkartTransactions.GetByCardIdAsync(card.Id, 100, ct);
        return transactions.Select(MapTransactionDto).ToList();
    }

    public async Task CancelMyApplicationAsync(Guid id, CancellationToken ct)
    {
        if (currentUser.Id is not Guid participantId)
            throw new ForbiddenException("Bu işlem için giriş yapmanız gerekiyor.", "FORBIDDEN");

        var app = await uow.BakkartApplications.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Bakkart başvurusu bulunamadı.", "BAKKART_APPLICATION_NOT_FOUND");

        if (app.ParticipantId != participantId)
            throw new ForbiddenException("Bu başvuru size ait değil.", "FORBIDDEN");

        if (app.Status != BakkartApplicationStatus.Pending)
            throw new ConflictException("Yalnızca onay bekleyen başvurular iptal edilebilir.", "BAKKART_APPLICATION_NOT_PENDING");

        app.Cancel();
        uow.BakkartApplications.Update(app);
        await uow.SaveChangesAsync(ct);
    }
}
