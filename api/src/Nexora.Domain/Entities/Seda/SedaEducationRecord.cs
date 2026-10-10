using Nexora.Domain.Common;

namespace Nexora.Domain.Entities.Seda;

public class SedaEducationRecord : BaseEntity
{
    public string Tckn { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string AcademicYear { get; private set; } = string.Empty;
    public Guid? ParticipantId { get; private set; }
    public Guid? PeriodId { get; private set; }
    public decimal? Score { get; private set; }
    public string? ResultNote { get; private set; }
    // Kullanıcı isteği (2026-08-12): "yüklenen excelde sıralama mı hak kazandı kazanmadı mı
    // yaptığı netler mi neler olduğu verilen excel dökümanına göre alınıp yapılacak" — gerçek
    // Excel dosyasının tam sütun yapısı önceden bilinmediği için: sık kullanılacak alanlar
    // (Rank/Phone/IsWinner) tip'li kolon olarak eklendi, TANIMADIĞIMIZ her sütun ise
    // DetailsJson'a ham başlık→değer olarak düşer (veri kaybı olmasın diye) — bkz.
    // docs/superpowers/specs/2026-08-12-seda-kazananlar-esnek-excel-telefon-sorgu-design.md
    public int? Rank { get; private set; }
    public string? Phone { get; private set; }
    public bool IsWinner { get; private set; } = true;
    public string DetailsJson { get; private set; } = "{}";

    public static SedaEducationRecord Create(
        string tckn, string fullName, string academicYear, Guid? participantId = null, Guid? periodId = null,
        decimal? score = null, string? resultNote = null, int? rank = null, string? phone = null,
        bool isWinner = true, string? detailsJson = null)
        => new()
        {
            Tckn = tckn,
            FullName = fullName,
            AcademicYear = academicYear,
            ParticipantId = participantId,
            PeriodId = periodId,
            Score = score,
            ResultNote = resultNote,
            Rank = rank,
            Phone = phone,
            IsWinner = isWinner,
            DetailsJson = string.IsNullOrWhiteSpace(detailsJson) ? "{}" : detailsJson,
        };

    public void UpdateFullName(string fullName)
    {
        FullName = fullName;
        UpdatedAt = DateTime.UtcNow;
    }

    public void LinkParticipant(Guid id)
    {
        ParticipantId = id;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateResult(decimal? score, string? resultNote)
    {
        Score = score;
        ResultNote = string.IsNullOrWhiteSpace(resultNote) ? null : resultNote.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void LinkPeriod(Guid periodId)
    {
        PeriodId = periodId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateFlexibleFields(int? rank, string? phone, bool isWinner, string? detailsJson)
    {
        Rank = rank;
        Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim();
        IsWinner = isWinner;
        if (!string.IsNullOrWhiteSpace(detailsJson)) DetailsJson = detailsJson;
        UpdatedAt = DateTime.UtcNow;
    }
}
