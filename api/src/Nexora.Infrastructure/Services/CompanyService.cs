using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Companies;
using Nexora.Application.Features.Companies.Dtos;
using Nexora.Application.Features.CompanyAuth;
using Nexora.Domain.Entities.Companies;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Security;
using Nexora.Infrastructure.Services.Email;
using Nexora.Infrastructure.Storage;

namespace Nexora.Infrastructure.Services;

public class CompanyService(
    IUnitOfWork uow,
    IAuditService audit,
    ICurrentUser currentUser,
    INotificationDispatcher dispatcher,
    IConfiguration configuration,
    IServiceProvider serviceProvider,
    IOptionsMonitor<MinioSettings> minioOptions,
    ICompanyAuthService companyAuth,
    ICompanySettingsService settings) : ICompanyService
{
    private const string Module = "Companies";

    public async Task<PagedResult<CompanyDto>> GetPagedAsync(CompanyListParams p, CancellationToken ct)
    {
        var paged = await uow.Companies.GetPagedAsync(p, ct);
        var dtos = new List<CompanyDto>(paged.Items.Count);
        foreach (var company in paged.Items)
        {
            var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
            var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
            dtos.Add(MapDto(company, totalCampaigns, totalUsages));
        }

        return new PagedResult<CompanyDto>
        {
            Items = dtos,
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    public async Task<CompanySummaryDto> GetSummaryAsync(CompanyListParams p, CancellationToken ct)
        => await uow.Companies.GetSummaryAsync(p, ct);

    public async Task<CompanyDashboardDto> GetDashboardAsync(CancellationToken ct)
        => await uow.Companies.GetDashboardAsync(ct);

    public async Task<IReadOnlyList<CompanyOptionDto>> GetOptionsAsync(CancellationToken ct)
    {
        var companies = await uow.Companies.GetActiveOptionsAsync(ct);
        return companies.Select(c => new CompanyOptionDto(c.Id.ToString(), c.Name)).ToList();
    }

    public async Task<CompanyDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");
        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task<CompanyDto> CreateAsync(CreateCompanyRequest req, CancellationToken ct)
    {
        if (await uow.Companies.ExistsByPhoneAsync(req.Phone, null, ct))
            throw new ConflictException("Bu telefon numarası ile kayıtlı firma var.", "DUPLICATE_PHONE");

        if (!string.IsNullOrWhiteSpace(req.Email) && await uow.Companies.ExistsByEmailAsync(req.Email, null, ct))
            throw new ConflictException("Bu e-posta ile kayıtlı firma var.", "DUPLICATE_EMAIL");

        if (await uow.Companies.ExistsByTaxNumberAsync(req.TaxNumber, null, ct))
            throw new ConflictException("Bu vergi numarası ile kayıtlı firma var.", "DUPLICATE_TAX_NUMBER");

        var isSms = string.Equals(req.DeliveryChannel, "Sms", StringComparison.OrdinalIgnoreCase);

        var generatedPassword = GeneratePassword();
        var passwordHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        var company = Company.Create(req.Name, req.TaxNumber, req.Phone, req.Email, req.Address,
            req.District ?? "Bakırköy", passwordHash);
        company.UpdateProfile(req.Name, req.Phone, req.Email, req.Address, req.District ?? "Bakırköy",
            req.Logo, req.BannerImage, req.Description, req.Website, MapSocial(req.SocialMedia),
            req.Latitude, req.Longitude, bannerImageMobile: req.BannerImageMobile);
        company.RequireInitialPasswordChange();

        company.SetServiceCategory(req.ServiceCategoryId);

        await uow.Companies.AddAsync(company, ct);
        await uow.SaveChangesAsync(ct);

        if (isSms)
        {
            var ctx = new CompanyNotificationContext(company.Name, generatedPassword);
            var body = await settings.TryRenderAsync("temporary_password", ctx, ct)
                ?? $"Sayın {company.Name}, firma giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.";
            await dispatcher.SendSmsAsync(company.Phone, body, ct);
        }
        else if (!string.IsNullOrWhiteSpace(company.Email))
        {
            var email = EmailTemplates.CompanyCredentials(company.Name, company.Email, generatedPassword, "");
            await dispatcher.SendEmailAsync(company.Email, email.Subject, email.HtmlBody, ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Create,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma oluşturuldu, geçici şifre gönderildi ({(isSms ? "SMS" : "E-posta")}), ilk girişte değişim zorunlu: {company.Name}",
            NewValues = JsonSerializer.Serialize(Snapshot(company)),
        }, ct);

        return MapDto(company, 0, 0);
    }

    public async Task<CompanyDto> UpdateAsync(Guid id, UpdateCompanyRequest req, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (await uow.Companies.ExistsByPhoneAsync(req.Phone, id, ct))
            throw new ConflictException("Bu telefon numarası ile kayıtlı firma var.", "DUPLICATE_PHONE");

        if (!string.IsNullOrWhiteSpace(req.Email) && await uow.Companies.ExistsByEmailAsync(req.Email, id, ct))
            throw new ConflictException("Bu e-posta ile kayıtlı firma var.", "DUPLICATE_EMAIL");

        var before = JsonSerializer.Serialize(Snapshot(company));
        company.UpdateProfile(req.Name, req.Phone, req.Email, req.Address, req.District ?? company.District,
            req.Logo, req.BannerImage, req.Description, req.Website, MapSocial(req.SocialMedia),
            req.Latitude, req.Longitude, req.GalleryImages, req.ServiceDescription, req.BannerImageMobile);

        company.SetServiceCategory(req.ServiceCategoryId);

        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma güncellendi: {company.Name}",
            OldValues = before,
            NewValues = JsonSerializer.Serialize(Snapshot(company)),
        }, ct);

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var activeCampaigns = await uow.Campaigns.CountActiveByCompanyAsync(company.Id, ct);
        if (activeCampaigns > 0)
            throw new ConflictException("Bu firmaya bağlı aktif kampanyalar var. Önce kampanyaları pasife alın.", "FK_VIOLATION");

        uow.Companies.Delete(company);
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Delete,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma silindi: {company.Name}",
        }, ct);
    }

    public async Task<CompanyDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var wasApproved = company.Status == CompanyStatus.Approved;
        if (wasApproved)
        {
            var activeCampaigns = await uow.Campaigns.CountActiveByCompanyAsync(company.Id, ct);
            if (activeCampaigns > 0)
                throw new ConflictException("Bu firmaya bağlı aktif kampanyalar var. Önce kampanyaları pasife alın.", "FK_VIOLATION");
            company.SetStatus(CompanyStatus.Passive);
        }
        else if (company.Status == CompanyStatus.Passive)
        {
            company.SetStatus(CompanyStatus.Approved);
        }
        else
        {
            throw new ConflictException("Yalnızca onaylı veya pasif firmaların durumu değiştirilebilir.", "INVALID_STATE");
        }

        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        // Onaylı firma pasife alındığında mevcut oturumu sonlandırılır; aksi halde eski
        // token ile giriş devam eder (bkz. Participant/AdminUser'da aynı desende bulunan P0 bulgusu).
        if (wasApproved)
            await companyAuth.TerminateSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma durumu değiştirildi: {company.Name} → {company.Status}",
        }, ct);

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task<CompanyDto> UnlockAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (company.IsLocked || company.FailedLoginCount > 0)
        {
            company.Unlock();
            uow.Companies.Update(company);
            await uow.SaveChangesAsync(ct);

            await audit.LogAsync(new AuditEntry
            {
                Action = AuditAction.StatusChange,
                EntityType = "Company",
                EntityId = company.Id,
                Module = Module,
                Description = $"Firma hesap kilidi kaldırıldı: {company.Name}",
            }, ct);
        }

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task<CompanyDto> ApproveAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (company.Status == CompanyStatus.Approved)
            throw new ConflictException("Bu firma zaten onaylanmış.", "ALREADY_APPROVED");

        company.Approve(currentUser.Name);
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        var approvedBody = await settings.TryRenderAsync("approved", new CompanyNotificationContext(company.Name), ct)
            ?? $"Sayın {company.Name}, firmanız onaylandı. Kampanya oluşturabilirsiniz.";
        await dispatcher.SendSmsAsync(company.Phone, approvedBody, ct);
        if (!string.IsNullOrWhiteSpace(company.Email))
        {
            var approvedMail = EmailTemplates.Notification(company.Name, approvedBody);
            await dispatcher.SendEmailAsync(company.Email, approvedMail.Subject, approvedMail.HtmlBody, ct);
        }

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Approve,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma onaylandı: {company.Name}",
        }, ct);

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task<CompanyDto> RejectAsync(Guid id, RejectCompanyRequest req, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var wasApproved = company.Status == CompanyStatus.Approved;
        company.Reject(req.Reason);
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        if (wasApproved)
            await companyAuth.TerminateSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Reject,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma reddedildi: {company.Name}",
        }, ct);

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task<CompanyDto> RevertApprovalAsync(Guid id, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdWithServiceCategoryAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        if (company.Status != CompanyStatus.Approved)
            throw new ConflictException("Yalnızca onaylı firmalar onaysıza çekilebilir.", "INVALID_STATE");

        var activeCampaigns = await uow.Campaigns.CountActiveByCompanyAsync(company.Id, ct);
        if (activeCampaigns > 0)
            throw new ConflictException("Bu firmaya bağlı aktif kampanyalar var. Önce kampanyaları pasife alın.", "FK_VIOLATION");

        company.RevertApproval();
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        await companyAuth.TerminateSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.StatusChange,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Firma onayı geri alındı (beklemeye alındı): {company.Name}",
        }, ct);

        var totalCampaigns = await uow.Companies.CountCampaignTotalsAsync(company.Id, ct);
        var totalUsages = await uow.Companies.CountUsageTotalsAsync(company.Id, ct);
        return MapDto(company, totalCampaigns, totalUsages);
    }

    public async Task SendPasswordResetAsync(Guid id, CompanySendPasswordResetRequest req, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var isSms = req.Channel == "Sms";
        var target = isSms ? company.Phone : company.Email;
        if (string.IsNullOrWhiteSpace(target))
            throw new ConflictException(isSms ? "Telefon numarası tanımlı değil." : "E-posta adresi tanımlı değil.", "CONTACT_NOT_SET");

        var length = configuration.GetValue<int>("PasswordPolicy:GeneratedLength");
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        var generatedPassword = PasswordGenerator.Generate(length, useMock);
        var newHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

        if (isSms)
        {
            var body = await settings.TryRenderAsync("password_reset", new CompanyNotificationContext(company.Name, generatedPassword), ct)
                ?? $"Sayın {company.Name}, yeni giriş şifreniz: {generatedPassword}. İlk girişte değiştirmeniz zorunludur.";
            var delivered = await dispatcher.SendSmsAsync(target, body, ct);
            if (!delivered)
                throw new ConflictException("Geçici şifre SMS ile gönderilemedi. Mevcut şifre korundu; lütfen daha sonra tekrar deneyin.", "CREDENTIAL_DELIVERY_FAILED");
        }
        else if (!string.IsNullOrWhiteSpace(company.Email))
        {
            var email = EmailTemplates.CompanyCredentials(company.Name, company.Email, generatedPassword, "");
            await dispatcher.SendEmailAsync(company.Email, email.Subject, email.HtmlBody, ct);
        }

        company.ResetTemporaryPassword(newHash);
        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        await companyAuth.TerminateSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = $"Geçici şifre gönderildi, ilk girişte değişim zorunlu ({(isSms ? "SMS" : "E-posta")}): {company.Name}",
        }, ct);
    }

    public async Task SetManualPasswordAsync(Guid id, CompanySetManualPasswordRequest req, CancellationToken ct)
    {
        var company = await uow.Companies.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Firma bulunamadı.", "COMPANY_NOT_FOUND");

        var hash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(req.NewPassword);
        if (req.MustChangeOnFirstLogin)
            company.ResetTemporaryPassword(hash);
        else
            company.CompleteInitialPassword(hash);

        uow.Companies.Update(company);
        await uow.SaveChangesAsync(ct);

        await companyAuth.TerminateSessionsAsync(company.Id, ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.PasswordReset,
            EntityType = "Company",
            EntityId = company.Id,
            Module = Module,
            Description = req.MustChangeOnFirstLogin
                ? $"Şifre yönetici tarafından elle belirlendi; ilk girişte değişim zorunlu: {company.Name}"
                : $"Şifre yönetici tarafından elle belirlendi: {company.Name}",
        }, ct);
    }

    public async Task<string> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken ct)
    {
        var storage = serviceProvider.GetService<IFileStorageService>()
            ?? throw new ConflictException("Dosya depolama servisi yapılandırılmamış.", "STORAGE_NOT_CONFIGURED");

        var bucket = minioOptions.CurrentValue.PublicBucket;
        var result = await storage.UploadAsync(stream, fileName, contentType, bucket, ct);
        return result.Url;
    }

    public async Task<CompanyImportResultDto> ImportAsync(Stream excelStream, CancellationToken ct)
    {
        // DÜZELTME (2026-08-26, ÜÇÜNCÜ TUR export/import denetimi, madde #1): uzantısı .xlsx
        // olan ama gerçekte geçersiz/bozuk (Excel/ZIP formatında olmayan) bir dosya yüklendiğinde
        // ClosedXML'in FileFormatException/InvalidDataException/IOException'ı önceden hiç
        // yakalanmıyordu, middleware'e kadar boşalıp genel 500 dönüyordu. Diğer format
        // hatalarıyla (EXCEL_EMPTY/EXCEL_NO_DATA) tutarlı, kullanıcı dostu 409'a çevrildi.
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(excelStream);
        }
        catch (Exception ex) when (ex is IOException or InvalidDataException or System.IO.FileFormatException)
        {
            throw new ConflictException("Geçersiz veya bozuk Excel dosyası. Lütfen dosyayı kontrol edip tekrar deneyin.", "EXCEL_INVALID_FORMAT");
        }
        using var _wb = wb;
        var ws = wb.Worksheets.FirstOrDefault()
            ?? throw new ConflictException("Excel dosyasında sayfa bulunamadı.", "EXCEL_EMPTY");

        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        if (lastCol == 0 || lastRow < 2)
            throw new ConflictException("Excel dosyasında veri satırı bulunamadı.", "EXCEL_NO_DATA");

        // DÜZELTME (madde #2): Seda import'undaki gibi üst satır sınırı — önceden CompanyService
        // sınırsız satır kabul ediyordu (DoS/performans riski).
        var maxRows = configuration.GetValue("CompanySettings:ImportMaxRows", 20000);
        if (lastRow - 1 > maxRows)
            throw new ConflictException($"Excel dosyası en fazla {maxRows} satır içerebilir. Lütfen dosyayı bölerek yükleyin.", "EXCEL_TOO_MANY_ROWS");

        var cols = ResolveColumns(ws, lastCol);
        if (cols.NameCol == 0)
            throw new ConflictException("Excel dosyasında \"Firma Adı\" sütunu bulunamadı.", "EXCEL_NAME_COLUMN_NOT_FOUND");
        if (cols.TaxCol == 0)
            throw new ConflictException("Excel dosyasında \"Vergi Numarası\" sütunu bulunamadı.", "EXCEL_TAX_COLUMN_NOT_FOUND");
        if (cols.PhoneCol == 0)
            throw new ConflictException("Excel dosyasında \"Telefon\" sütunu bulunamadı.", "EXCEL_PHONE_COLUMN_NOT_FOUND");

        var otherCategory = await GetOrCreateOtherCategoryAsync(ct);
        var categories = await uow.ServiceCategories.GetActiveAsync(ct);

        var rowsInFile = new List<(int Row, string Name, string TaxNumber, string Phone, string Address)>();
        var results = new List<CompanyImportRowResultDto>();
        var seenTax = new HashSet<string>();
        var seenPhone = new HashSet<string>();
        var totalRows = 0;
        var emptyStreak = 0;

        for (var row = 2; row <= lastRow; row++)
        {
            // DÜZELTME (madde #5B): gerçek Excel formülü (örn. "=cmd|'/c calc'!A1") içeren bir
            // hücre GetString() ile sessizce boş string döner (formül hesaplanmamış <v/> boş
            // değeri). Kullanıcıya "isim boş" gibi yanıltıcı bir hata yerine formülün kendisini
            // gösteren net bir uyarı veriliyor.
            if (ws.Cell(row, cols.NameCol).HasFormula || ws.Cell(row, cols.TaxCol).HasFormula || ws.Cell(row, cols.PhoneCol).HasFormula)
            {
                results.Add(new CompanyImportRowResultDto(row, "(formül hücresi)", "Hata", "Bu satırda formül içeren bir hücre var. Lütfen düz metin/sayı olarak girin.", null));
                totalRows++;
                continue;
            }

            var name = ws.Cell(row, cols.NameCol).GetString().Trim();
            var rawTax = ws.Cell(row, cols.TaxCol).GetString().Trim();
            var rawPhone = ws.Cell(row, cols.PhoneCol).GetString().Trim();
            var address = cols.AddressCol > 0 ? ws.Cell(row, cols.AddressCol).GetString().Trim() : "";

            if (name.Length == 0 && rawTax.Length == 0 && rawPhone.Length == 0)
            {
                emptyStreak++;
                if (emptyStreak >= 10) break;
                continue;
            }
            emptyStreak = 0;
            totalRows++;

            var taxNumber = new string(rawTax.Where(char.IsDigit).ToArray());
            var phone = NormalizePhone(rawPhone);

            if (name.Length == 0)
            {
                results.Add(new CompanyImportRowResultDto(row, "(isim yok)", "Hata", "Firma adı boş.", null));
                continue;
            }
            // DÜZELTME (madde #3): Name(200)/Address(500) DB kısıtlaması önceden hiç ön-doğrulanmıyordu.
            // Tek bir çok-uzun satır, döngü sonunda tek bir SaveChangesAsync çağrıldığı için (satır
            // aşağıda) TÜM batch'i (geçerli satırlar dahil) sessizce 500 ile geri alıyordu.
            if (name.Length > 200)
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Hata", "Firma adı çok uzun (en fazla 200 karakter).", null));
                continue;
            }
            if (address.Length > 500)
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Hata", "Adres çok uzun (en fazla 500 karakter).", null));
                continue;
            }
            if (taxNumber.Length is not (10 or 11))
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Hata", $"Vergi numarası geçersiz ({rawTax}).", null));
                continue;
            }
            if (phone is null)
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Hata", $"Telefon numarası geçersiz ({rawPhone}).", null));
                continue;
            }
            if (address.Length == 0)
                address = "Adres belirtilmemiş";

            if (!seenTax.Add(taxNumber))
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Atlandı", $"Dosya içinde mükerrer vergi numarası ({taxNumber}).", null));
                continue;
            }
            if (!seenPhone.Add(phone))
            {
                results.Add(new CompanyImportRowResultDto(row, name, "Atlandı", $"Dosya içinde mükerrer telefon numarası ({phone}).", null));
                continue;
            }

            rowsInFile.Add((row, name, taxNumber, phone, address));
        }

        var added = 0;
        var skipped = 0;
        var failed = results.Count;

        foreach (var r in rowsInFile)
        {
            if (await uow.Companies.ExistsByTaxNumberAsync(r.TaxNumber, null, ct))
            {
                results.Add(new CompanyImportRowResultDto(r.Row, r.Name, "Atlandı", "Bu vergi numarasıyla kayıtlı firma zaten var.", null));
                skipped++;
                continue;
            }
            if (await uow.Companies.ExistsByPhoneAsync(r.Phone, null, ct))
            {
                results.Add(new CompanyImportRowResultDto(r.Row, r.Name, "Atlandı", "Bu telefon numarasıyla kayıtlı firma zaten var.", null));
                skipped++;
                continue;
            }

            var category = ClassifyCategory(r.Name, categories) ?? otherCategory;
            var generatedPassword = GeneratePassword();
            var passwordHash = Nexora.Infrastructure.Security.TimingSafeAuth.HashPassword(generatedPassword);

            var company = Company.Create(r.Name, r.TaxNumber, r.Phone, null, r.Address, "Bakırköy", passwordHash);
            company.UpdateProfile(r.Name, r.Phone, null, r.Address, "Bakırköy",
                null, null, null, null, null, null, null);
            company.RequireInitialPasswordChange();
            company.SetServiceCategory(category.Id);

            await uow.Companies.AddAsync(company, ct);
            results.Add(new CompanyImportRowResultDto(r.Row, r.Name, "Eklendi", null, category.Name));
            added++;
        }

        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Import,
            EntityType = "Company",
            EntityId = Guid.Empty,
            Module = Module,
            Description = $"Firmalar.xlsx toplu içe aktarım: {totalRows} satır, {added} eklendi, {skipped} atlandı (mükerrer), {failed} hatalı.",
        }, ct);

        return new CompanyImportResultDto(totalRows, added, skipped, failed,
            results.OrderBy(x => x.Row).ToList());
    }

    private async Task<ServiceCategory> GetOrCreateOtherCategoryAsync(CancellationToken ct)
    {
        const string name = "Diğer";
        var existing = await uow.ServiceCategories.GetByNameAsync(name, ct);
        if (existing is not null) return existing;

        var category = ServiceCategory.Create(name, "Otomatik sınıflandırılamayan firmalar için genel kategori.", "#8B95A1");
        await uow.ServiceCategories.AddAsync(category, ct);
        await uow.SaveChangesAsync(ct);
        return category;
    }

    private static readonly Dictionary<string, string[]> CategoryKeywords = new()
    {
        ["Restoran ve Yemek"] = ["döner", "pide", "lahmacun", "kebap", "çiğköfte", "cigkofte", "yemek", "sofra",
            "çorba", "corba", "mangal", "kokoreç", "kokorec", "sandviç", "sandvic", "dürüm", "durum", "lokanta",
            "restoran", "mutfak", "cızbız", "cizbiz", "tavuk", "şahmaran", "sahmaran", "pilav", "ızgara", "izgara",
            "börek", "köfte", "kofte", "peynircilik", "kebabı", "kebabi"],
        ["Kafe ve Pastane"] = ["pastane", "kahve", "cafe", "kahvaltı", "kahvalti", "tatlı", "tatli", "baklava",
            "dondurma", "fırın", "firin", "unlu mamül", "unlu mamul", "waffle", "çörek", "corek", "tatlıcı",
            "tatlici", "lounge", "lounce", "çerez", "cerez"],
        ["Giyim ve Aksesuar"] = ["giyim", "butik", "tekstil", "moda", "kumaş", "kumas", "terzi", "çeyiz", "ceyiz",
            "gelinlik", "eşarp", "esarp", "şal", "iç giyim", "underwear", "bebe", "çanta", "canta", "ayakkabı",
            "ayakkabi", "kundara", "bujiteri", "outlet", "abiye", "mağazacılık", "magazacilik"],
        ["Berber ve Kuaför"] = ["kuaför", "kuafor", "berber", "hair", "barber"],
        ["Sağlık ve Güzellik"] = ["güzellik", "guzellik", "dent", "medikal", "spa", "estetik"],
        ["Eczane"] = ["eczane"],
        ["Optik"] = ["optik", "gözlük", "gozluk"],
        ["Market ve Gıda"] = ["market", "gıda", "gida", "kuruyemiş", "kuruyemis", "bakkal", "şarküteri",
            "sarkuteri", "kasap", "balık", "balik", "çiçek", "cicek", "avm", "büfe", "bufe", "pazar",
            "veteriner", "petshop", "akvaryum", "manav", "aktar", "baharat"],
        ["Teknoloji ve Elektronik"] = ["bilgisayar", "elektronik", "telefon", "aydınlatma", "aydinlatma",
            "iletişim", "iletisim", "dijital"],
        ["Eğitim ve Kurs"] = ["kurs", "okul", "eğitim", "egitim", "sürücü", "surucu", "english", "time"],
        ["Spor ve Fitness"] = ["spor", "fitness", " fit "],
    };

    private static ServiceCategory? ClassifyCategory(string companyName, List<ServiceCategory> categories)
    {
        var n = companyName.ToLowerInvariant();
        foreach (var (catName, keywords) in CategoryKeywords)
        {
            if (keywords.Any(kw => n.Contains(kw)))
            {
                var match = categories.FirstOrDefault(c => c.Name.Equals(catName, StringComparison.OrdinalIgnoreCase));
                if (match is not null) return match;
            }
        }
        return null;
    }

    private static string? NormalizePhone(string raw)
    {
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 10 && digits[0] == '5') digits = "0" + digits;
        return digits.Length == 11 && digits[0] == '0' ? digits : null;
    }

    private static (int NameCol, int TaxCol, int PhoneCol, int AddressCol) ResolveColumns(IXLWorksheet ws, int lastCol)
    {
        var headers = new string[lastCol + 1];
        for (var col = 1; col <= lastCol; col++)
            headers[col] = ws.Cell(1, col).GetString().Trim().ToUpperInvariant();

        int Find(params string[] needles)
        {
            for (var col = 1; col <= lastCol; col++)
                foreach (var needle in needles)
                    if (headers[col].Contains(needle)) return col;
            return 0;
        }

        return (
            Find("FİRMA ADI", "FIRMA ADI", "AD SOYAD", "FİRMA", "FIRMA"),
            Find("VERGİ", "VERGI"),
            Find("TELEFON", "TEL"),
            Find("ADRES"));
    }

    private string GeneratePassword()
    {
        var length = configuration.GetValue("PasswordPolicy:GeneratedLength", 8);
        var useMock = configuration.GetValue("SmsSettings:UseMockMode", false);
        return PasswordGenerator.Generate(length, useMock);
    }

    private static CompanySocialMedia? MapSocial(CompanySocialMediaDto? dto)
        => dto is null ? null : new CompanySocialMedia
        {
            Facebook = dto.Facebook,
            Instagram = dto.Instagram,
            Twitter = dto.Twitter,
            Linkedin = dto.Linkedin,
        };

    private static CompanySocialMediaDto? MapSocialDto(CompanySocialMedia? social)
        => social is null ? null : new CompanySocialMediaDto(social.Facebook, social.Instagram, social.Twitter, social.Linkedin);

    private static CompanyDto MapDto(Company c, int totalCampaigns, int totalUsages)
        => new(
            c.Id, c.Name, c.TaxNumber, c.Phone, c.Email, c.Address, c.District,
            c.Status.ToString(), c.EmailVerified, c.PhoneVerified,
            c.Logo, c.BannerImage, c.BannerImageMobile, c.Description, c.Website, MapSocialDto(c.SocialMedia),
            c.Latitude, c.Longitude, c.RejectReason,
            c.ServiceCategory is not null ? new ServiceCategoryRefDto(c.ServiceCategory.Id, c.ServiceCategory.Name, c.ServiceCategory.Color) : null,
            totalCampaigns, totalUsages, c.CreatedAt, c.UpdatedAt, c.GalleryImages, c.ServiceDescription,
            KvkkAccepted: c.KvkkAcceptedAt.HasValue, NotificationConsentAccepted: c.NotificationConsentAcceptedAt.HasValue,
            GooglePlaceId: c.GooglePlaceId, IsLocked: c.IsLocked, LockedUntil: c.LockedUntil);

    private static object Snapshot(Company c) => new
    {
        c.Name,
        c.Email,
        c.TaxNumber,
        c.Phone,
        Status = c.Status.ToString(),
    };
}
