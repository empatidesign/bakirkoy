using System.Globalization;
using Nexora.Application.Features.Travels;

namespace Nexora.Infrastructure.Services;

/// <summary>
/// Kullanıcı isteği (2026-08-07): birleşik gezi mesaj şablonu sisteminin tek ortak
/// {{placeholder}} interpolasyon motoru. TravelNotificationService, TravelDepartureReminderJob
/// ve manuel/toplu mesaj gönderme akışı — hepsi aynı Render() metodunu kullanır, böylece
/// değişken davranışı (tarih formatı, ad/soyad ayrımı) her yerde tutarlıdır.
///
/// Desteklenen değişkenler: {{ad}} {{soyad}} {{sefer}} {{tarih}} {{saat}} {{guzergah}}
/// {{kalkis_noktasi}} {{sira}}
/// </summary>
public static class TravelMessageRenderer
{
    private static readonly CultureInfo Tr = new("tr-TR");

    public static string Render(string template, string fullName, TravelNotificationContext travel, int? waitlistPosition = null)
    {
        var name = fullName ?? string.Empty;
        var spaceIdx = name.IndexOf(' ');
        var firstName = spaceIdx > 0 ? name[..spaceIdx] : name;
        var lastName = spaceIdx > 0 ? name[(spaceIdx + 1)..] : string.Empty;

        return template
            .Replace("{{ad}}", firstName)
            .Replace("{{soyad}}", lastName)
            .Replace("{{sefer}}", travel.TravelName)
            .Replace("{{tarih}}", travel.StartDate.ToString("dd.MM.yyyy", Tr))
            .Replace("{{saat}}", travel.StartDate.ToString("HH:mm", Tr))
            .Replace("{{guzergah}}", travel.Destination ?? string.Empty)
            .Replace("{{kalkis_noktasi}}", string.IsNullOrWhiteSpace(travel.DeparturePoint) ? "belirtilen buluşma noktası" : travel.DeparturePoint)
            .Replace("{{sira}}", waitlistPosition?.ToString(Tr) ?? string.Empty);
    }
}
