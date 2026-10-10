using Nexora.Domain.Common;
using Nexora.Domain.Enums;

namespace Nexora.Domain.Entities.Wheels;

public class Wheel : BaseEntity
{
    public string Title { get; private set; } = "";
    public string? Description { get; private set; }
    public List<WheelSlice> Slices { get; private set; } = [];
    public int DailySpinLimit { get; private set; }
    public int TotalSpins { get; private set; }
    public WheelStatus Status { get; private set; }

    // Kullanıcı isteği (2026-09-20): "gün içinde çark çeviren kaç kişiye kaç puan
    // verilecek, en yüksek puan ne olacak, kaç çevirmede olacak" — opsiyonel bir puan
    // algoritması. Kapalıysa (varsayılan) davranış değişmez: "points" tipi dilimler
    // kendi sabit Value'sunu verir. Açılırsa, o gün için kişinin KAÇINCI çevirmesi
    // olduğuna göre puan hesaplanır: 1. çevirmede PointsAlgorithmBase, sonraki her
    // çevirmede PointsAlgorithmStep kadar artar/azalır (negatif olabilir), tek
    // çevirmede PointsAlgorithmMax'ı aşamaz, ve PointsAlgorithmMaxSpins'i aşan
    // çevirmelerde (0 = sınırsız) algoritma uygulanmaz — dilimin kendi sabit Value'suna
    // geri döner. Bkz. Wheel.ComputeAlgorithmPoints, SpinService.SpinAsync.
    public bool PointsAlgorithmEnabled { get; private set; }
    public int PointsAlgorithmBase { get; private set; }
    public int PointsAlgorithmStep { get; private set; }
    public int PointsAlgorithmMax { get; private set; }
    public int PointsAlgorithmMaxSpins { get; private set; }
    public string ResidencyMode { get; private set; } = "anyone";

    public static Wheel Create(string title)
        => new() { Title = title.Trim(), Status = WheelStatus.Active };

    public void SetDetails(string title, string? description, int dailySpinLimit)
    {
        Title = title.Trim();
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        DailySpinLimit = Math.Max(0, dailySpinLimit);
    }

    public void SetResidencyMode(string? mode) => ResidencyMode = Nexora.Domain.Common.EligibilityRules.NormalizeResidencyMode(mode);

    public void SetPointsAlgorithm(bool enabled, int basePoints, int step, int maxPoints, int maxSpins)
    {
        PointsAlgorithmEnabled = enabled;
        PointsAlgorithmBase = Math.Max(0, basePoints);
        PointsAlgorithmStep = step;
        PointsAlgorithmMax = Math.Max(0, maxPoints);
        PointsAlgorithmMaxSpins = Math.Max(0, maxSpins);
    }

    /// <summary>
    /// spinNumberToday: kişinin bu çark için BUGÜN kaçıncı çevirmesi olduğu (1-based).
    /// Algoritma kapalıysa veya azami çevirme sayısını aştıysa null döner — çağıran
    /// taraf bu durumda dilimin kendi sabit Value'sunu kullanmalı.
    /// </summary>
    public int? ComputeAlgorithmPoints(int spinNumberToday)
    {
        if (!PointsAlgorithmEnabled) return null;
        if (PointsAlgorithmMaxSpins > 0 && spinNumberToday > PointsAlgorithmMaxSpins) return null;

        var points = PointsAlgorithmBase + PointsAlgorithmStep * (spinNumberToday - 1);
        points = Math.Max(0, points);
        if (PointsAlgorithmMax > 0) points = Math.Min(points, PointsAlgorithmMax);
        return points;
    }

    public void SetSlices(IEnumerable<WheelSlice> slices) => Slices = slices.ToList();

    public void SetStatus(WheelStatus status) => Status = status;

    public void SetTotalSpins(int total) => TotalSpins = Math.Max(0, total);

    public void IncrementSpins() => TotalSpins++;
}
