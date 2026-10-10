using System.Text.Json;
using Nexora.Domain.Common;
using FluentValidation;
using Nexora.Application.Common;
using Nexora.Application.Features.Facilities.Dtos;

namespace Nexora.Application.Features.Facilities.Validators;

public class CreateFacilityGroupRequestValidator : AbstractValidator<CreateFacilityGroupRequest>
{
    public CreateFacilityGroupRequestValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty().WithMessage("Tesis seçimi zorunludur.");
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Program seçimi zorunludur.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Grup adı zorunludur.")
            .MaximumLength(200).WithMessage("Grup adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Grup adı");
        RuleFor(x => x.Type).Must(FacilityGroupRules.BeValidType).WithMessage("Geçersiz grup türü.");
        RuleFor(x => x.Gender).Must(FacilityGroupRules.BeValidGender).WithMessage("Geçersiz cinsiyet.");
        RuleFor(x => x.AttendanceMode).Must(FacilityGroupRules.BeValidAttendanceMode).WithMessage("Geçersiz yoklama modu.");
        RuleFor(x => x.ResidencyMode).Must(FacilityGroupRules.BeValidResidencyMode).WithMessage("Geçersiz katılım bölgesi (başvuru kriteri).");
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0).WithMessage("Kontenjan negatif olamaz.");
        RuleFor(x => x.ReserveCapacity).GreaterThanOrEqualTo(0).WithMessage("Yedek kontenjan negatif olamaz.");
        RuleFor(x => x.AgeMin).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMax).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMin).LessThanOrEqualTo(120).WithMessage("En küçük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        RuleFor(x => x.AgeMax).LessThanOrEqualTo(120).WithMessage("En büyük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        When(x => x.IsActive, () =>
            RuleFor(x => x.Capacity).GreaterThan(0).WithMessage("Aktif grubun kontenjanı 0'dan büyük olmalıdır."));
        When(x => x.AgeMax > 0, () =>
            RuleFor(x => x.AgeMin).LessThanOrEqualTo(x => x.AgeMax).WithMessage("En küçük yaş, en büyük yaştan büyük olamaz."));
        RuleFor(x => x.PeriodMonths).GreaterThanOrEqualTo(0).WithMessage("Periyot süresi negatif olamaz.");
        RuleFor(x => x.AbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.ConsecutiveAbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Üst üste devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.EntryGraceMinutes).GreaterThanOrEqualTo(0).WithMessage("Giriş toleransı negatif olamaz.");
        When(x => x.PeriodType == "recurring", () =>
            RuleFor(x => x.PeriodMonths).GreaterThanOrEqualTo(1).WithMessage("Tekrarlı dönemde süre (ay) en az 1 olmalıdır."));
        When(x => x.PeriodUnit == "day", () =>
            RuleFor(x => x.PeriodDays).GreaterThanOrEqualTo(1).WithMessage("Gün bazlı dönemde süre en az 1 gün olmalıdır."));
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeValidSchedule).WithMessage("Gün-saat planı geçersiz: başlangıç saati bitişten önce ve SS:DD biçiminde olmalı.");
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeSingleSlotPerDay).WithMessage("Bir gün için yalnızca tek saat aralığı girilebilir.");
        RuleFor(x => x.Fee).Must(FacilityGroupRules.BeValidFee).WithMessage("Ücretli grupta geçerli bir ücret tutarı (0'dan büyük) ve ücret tipi girilmelidir.");
        When(x => x.PeriodStart.HasValue, () =>
            RuleFor(x => x.PeriodStart!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez."));
        When(x => x.ApplicationStartDate.HasValue, () =>
            RuleFor(x => x.ApplicationStartDate!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez."));
        When(x => x.ApplicationStartDate.HasValue && x.ApplicationEndDate.HasValue, () =>
            RuleFor(x => x.ApplicationEndDate!.Value)
                .GreaterThanOrEqualTo(x => x.ApplicationStartDate!.Value).WithMessage("Başvuru bitiş tarihi, başlangıç tarihinden önce olamaz."));
        When(x => x.ApplicationEndDate.HasValue, () =>
            RuleFor(x => x.ApplicationEndDate!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Başvuru bitiş tarihi geçmişte olamaz."));
    }
}

public class UpdateFacilityGroupRequestValidator : AbstractValidator<UpdateFacilityGroupRequest>
{
    public UpdateFacilityGroupRequestValidator()
    {
        RuleFor(x => x.FacilityId).NotEmpty().WithMessage("Tesis seçimi zorunludur.");
        RuleFor(x => x.BranchId).NotEmpty().WithMessage("Program seçimi zorunludur.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Grup adı zorunludur.")
            .MaximumLength(200).WithMessage("Grup adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Grup adı");
        RuleFor(x => x.Type).Must(FacilityGroupRules.BeValidType).WithMessage("Geçersiz grup türü.");
        RuleFor(x => x.Gender).Must(FacilityGroupRules.BeValidGender).WithMessage("Geçersiz cinsiyet.");
        RuleFor(x => x.AttendanceMode).Must(FacilityGroupRules.BeValidAttendanceMode).WithMessage("Geçersiz yoklama modu.");
        RuleFor(x => x.ResidencyMode).Must(FacilityGroupRules.BeValidResidencyMode).WithMessage("Geçersiz katılım bölgesi (başvuru kriteri).");
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0).WithMessage("Kontenjan negatif olamaz.");
        RuleFor(x => x.ReserveCapacity).GreaterThanOrEqualTo(0).WithMessage("Yedek kontenjan negatif olamaz.");
        RuleFor(x => x.AgeMin).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMax).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMin).LessThanOrEqualTo(120).WithMessage("En küçük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        RuleFor(x => x.AgeMax).LessThanOrEqualTo(120).WithMessage("En büyük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        When(x => x.IsActive, () =>
            RuleFor(x => x.Capacity).GreaterThan(0).WithMessage("Aktif grubun kontenjanı 0'dan büyük olmalıdır."));
        When(x => x.AgeMax > 0, () =>
            RuleFor(x => x.AgeMin).LessThanOrEqualTo(x => x.AgeMax).WithMessage("En küçük yaş, en büyük yaştan büyük olamaz."));
        RuleFor(x => x.PeriodMonths).GreaterThanOrEqualTo(0).WithMessage("Periyot süresi negatif olamaz.");
        RuleFor(x => x.AbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.ConsecutiveAbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Üst üste devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.EntryGraceMinutes).GreaterThanOrEqualTo(0).WithMessage("Giriş toleransı negatif olamaz.");
        When(x => x.PeriodType == "recurring", () =>
            RuleFor(x => x.PeriodMonths).GreaterThanOrEqualTo(1).WithMessage("Tekrarlı dönemde süre (ay) en az 1 olmalıdır."));
        When(x => x.PeriodUnit == "day", () =>
            RuleFor(x => x.PeriodDays).GreaterThanOrEqualTo(1).WithMessage("Gün bazlı dönemde süre en az 1 gün olmalıdır."));
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeValidSchedule).WithMessage("Gün-saat planı geçersiz: başlangıç saati bitişten önce ve SS:DD biçiminde olmalı.");
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeSingleSlotPerDay).WithMessage("Bir gün için yalnızca tek saat aralığı girilebilir.");
        RuleFor(x => x.Fee).Must(FacilityGroupRules.BeValidFee).WithMessage("Ücretli grupta geçerli bir ücret tutarı (0'dan büyük) ve ücret tipi girilmelidir.");
        When(x => x.ApplicationStartDate.HasValue && x.ApplicationEndDate.HasValue, () =>
            RuleFor(x => x.ApplicationEndDate!.Value)
                .GreaterThanOrEqualTo(x => x.ApplicationStartDate!.Value).WithMessage("Başvuru bitiş tarihi, başlangıç tarihinden önce olamaz."));
    }
}

public class CopyFacilityGroupRequestValidator : AbstractValidator<CopyFacilityGroupRequest>
{
    public CopyFacilityGroupRequestValidator()
    {
        RuleFor(x => x.TargetFacilityIds)
            .NotEmpty().WithMessage("En az bir hedef tesis seçilmelidir.");
        RuleForEach(x => x.TargetFacilityIds)
            .NotEmpty().WithMessage("Geçersiz hedef tesis.");
        RuleFor(x => x.Name)
            .MaximumLength(200).WithMessage("Grup adı en fazla 200 karakter olabilir.")
            .Must(n => n is null || !string.IsNullOrWhiteSpace(n)).WithMessage("Yeni grup adı boş olamaz.");
    }
}

public class CreateSubGroupRequestValidator : AbstractValidator<CreateSubGroupRequest>
{
    public CreateSubGroupRequestValidator()
    {
        RuleFor(x => x.ParentGroupId).NotEmpty().WithMessage("Ana grup seçimi zorunludur.");
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Alt grup adı zorunludur.")
            .MaximumLength(200).WithMessage("Alt grup adı 200 karakteri aşamaz.")
            .MustNotContainHtmlArtifacts("Alt grup adı");
        RuleFor(x => x.Gender).Must(FacilityGroupRules.BeValidGender).WithMessage("Geçersiz cinsiyet.");
        RuleFor(x => x.AttendanceMode).Must(FacilityGroupRules.BeValidAttendanceMode).WithMessage("Geçersiz yoklama modu.");
        RuleFor(x => x.ResidencyMode).Must(FacilityGroupRules.BeValidResidencyMode).WithMessage("Geçersiz katılım bölgesi (başvuru kriteri).");
        RuleFor(x => x.Capacity).GreaterThanOrEqualTo(0).WithMessage("Kontenjan negatif olamaz.");
        RuleFor(x => x.ReserveCapacity).GreaterThanOrEqualTo(0).WithMessage("Yedek kontenjan negatif olamaz.");
        RuleFor(x => x.AgeMin).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMax).GreaterThanOrEqualTo(0).WithMessage("Yaş aralığı geçersiz.");
        RuleFor(x => x.AgeMin).LessThanOrEqualTo(120).WithMessage("En küçük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        RuleFor(x => x.AgeMax).LessThanOrEqualTo(120).WithMessage("En büyük yaş 120'den büyük olamaz; doğum yılı değil yaş girin.");
        When(x => x.IsActive, () =>
            RuleFor(x => x.Capacity).GreaterThan(0).WithMessage("Aktif grubun kontenjanı 0'dan büyük olmalıdır."));
        When(x => x.AgeMax > 0, () =>
            RuleFor(x => x.AgeMin).LessThanOrEqualTo(x => x.AgeMax).WithMessage("En küçük yaş, en büyük yaştan büyük olamaz."));
        RuleFor(x => x.PeriodMonths).GreaterThanOrEqualTo(0).WithMessage("Periyot süresi negatif olamaz.");
        RuleFor(x => x.AbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.ConsecutiveAbsenceLimit).GreaterThanOrEqualTo(0).WithMessage("Üst üste devamsızlık hakkı negatif olamaz.");
        RuleFor(x => x.EntryGraceMinutes).GreaterThanOrEqualTo(0).WithMessage("Giriş toleransı negatif olamaz.");
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeValidSchedule).WithMessage("Gün-saat planı geçersiz: başlangıç saati bitişten önce ve SS:DD biçiminde olmalı.");
        RuleFor(x => x.Schedule).Must(FacilityGroupRules.BeSingleSlotPerDay).WithMessage("Bir gün için yalnızca tek saat aralığı girilebilir.");
        RuleFor(x => x.Fee).Must(FacilityGroupRules.BeValidFee).WithMessage("Ücretli grupta geçerli bir ücret tutarı (0'dan büyük) ve ücret tipi girilmelidir.");
        When(x => x.PeriodStart.HasValue, () =>
            RuleFor(x => x.PeriodStart!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez."));
        When(x => x.ApplicationStartDate.HasValue, () =>
            RuleFor(x => x.ApplicationStartDate!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Geçmiş tarih girilemez."));
        When(x => x.ApplicationStartDate.HasValue && x.ApplicationEndDate.HasValue, () =>
            RuleFor(x => x.ApplicationEndDate!.Value)
                .GreaterThanOrEqualTo(x => x.ApplicationStartDate!.Value).WithMessage("Başvuru bitiş tarihi, başlangıç tarihinden önce olamaz."));
        When(x => x.ApplicationEndDate.HasValue, () =>
            RuleFor(x => x.ApplicationEndDate!.Value)
                .GreaterThanOrEqualTo(TurkeyTime.TodayStartUtc()).WithMessage("Başvuru bitiş tarihi geçmişte olamaz."));
    }
}

internal static class FacilityGroupRules
{
    public static bool BeValidType(string t) => t is "kurs" or "akademi";
    public static bool BeValidGender(string g) => g is "male" or "female" or "mixed";
    public static bool BeValidAttendanceMode(string m) => m is "full" or "tracking_only" or "off";

    // UAT 2026-09-24: diğer tüm modüllerle (etkinlik, gezi, quiz, kütüphane, çark) birebir aynı
    // seçenek listesi — tek kaynak EligibilityRules.ValidResidencyModes ("outside_only" dahil).
    public static bool BeValidResidencyMode(string? m) => string.IsNullOrWhiteSpace(m)
        || Nexora.Domain.Common.EligibilityRules.ValidResidencyModes.Contains(m);

    public static bool BeValidSchedule(JsonElement schedule)
    {
        if (schedule.ValueKind != JsonValueKind.Array) return true;
        foreach (var slot in schedule.EnumerateArray())
        {
            if (slot.ValueKind != JsonValueKind.Object) return false;
            var start = slot.TryGetProperty("startTime", out var s) ? s.GetString() : null;
            var end = slot.TryGetProperty("endTime", out var e) ? e.GetString() : null;
            if (!IsValidTime(start) || !IsValidTime(end)) return false;
            if (string.CompareOrdinal(start, end) >= 0) return false;
        }
        return true;
    }

    public static bool BeSingleSlotPerDay(JsonElement schedule)
    {
        if (schedule.ValueKind != JsonValueKind.Array) return true;
        var seenDays = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var slot in schedule.EnumerateArray())
        {
            if (slot.ValueKind != JsonValueKind.Object) continue;
            var day = slot.TryGetProperty("day", out var d) ? d.GetString()?.Trim() : null;
            if (string.IsNullOrEmpty(day)) continue;
            if (!seenDays.Add(day)) return false;
        }
        return true;
    }

    public static bool BeValidFee(JsonElement fee)
    {
        if (fee.ValueKind != JsonValueKind.Object) return true;
        var isPaid = fee.TryGetProperty("isPaid", out var p) && p.ValueKind == JsonValueKind.True;
        if (!isPaid) return true;
        decimal amount = 0;
        if (fee.TryGetProperty("amount", out var a))
        {
            if (a.ValueKind == JsonValueKind.Number) a.TryGetDecimal(out amount);
            else if (a.ValueKind == JsonValueKind.String && decimal.TryParse(a.GetString(), out var parsed)) amount = parsed;
        }
        if (amount <= 0) return false;
        var feeType = fee.TryGetProperty("feeType", out var t) ? t.GetString() : null;
        return feeType is "monthly" or "term" or "yearly" or "once";
    }

    private static bool IsValidTime(string? t)
    {
        if (string.IsNullOrEmpty(t) || t.Length != 5 || t[2] != ':') return false;
        return int.TryParse(t.AsSpan(0, 2), out var h) && h is >= 0 and <= 23
            && int.TryParse(t.AsSpan(3, 2), out var m) && m is >= 0 and <= 59;
    }
}
