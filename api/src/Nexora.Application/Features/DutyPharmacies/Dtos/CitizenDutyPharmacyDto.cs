namespace Nexora.Application.Features.DutyPharmacies.Dtos;

public record CitizenDutyPharmacyDto(
    Guid Id,
    string Name,
    string? Phone,
    string? Directions,
    string? Address,
    string? Neighborhood,
    string District,
    double? Latitude,
    double? Longitude,
    string? DutyEndTime,
    DateOnly DutyDate,
    DateTime SyncedAt,
    // Bulgu (2026-09-21 uçtan uca testi, J1): liste "bugünün tarihine" göre değil
    // "tablodaki en son tarihe" göre dönüyor. Sync bir gün atlarsa vatandaşa dünün
    // nöbetçisi hiçbir uyarı olmadan "bugünün nöbetçisi" gibi gösteriliyordu.
    // IsStale=true ise istemci "Bu bilgi {DutyDate} tarihine aittir, güncel olmayabilir"
    // uyarısı göstermelidir.
    bool IsStale = false);
