namespace Nexora.Application.Features.Travels.Dtos;

public record TravelApplicationPassengerDto(
    Guid Id,
    Guid ParticipantId,
    string ParticipantName,
    string Tckn,
    string Gender,
    Guid? BusId,
    string? BusName,
    string? SeatNumber,
    bool IsPrimary,
    string Status
);

public record TravelApplicationDto(
    Guid Id,
    Guid TravelId,
    string TravelName,
    Guid ParticipantId,
    string ParticipantName,
    string Tckn,
    string Phone,
    string Email,
    string Gender,
    DateTime? BirthDate,
    string? Neighborhood,
    string? Address,
    DateTime ApplicationDate,
    DateTime? TravelStartDate,
    DateTime? TravelEndDate,
    string Status,
    string DocumentStatus,
    string PaymentStatus,
    Guid? BusId,
    string? BusName,
    string? SeatNumber,
    string Notes,
    string? EmergencyContactName,
    string? EmergencyContactPhone,
    List<TravelApplicationPassengerDto> Passengers,
    bool IsGuest = false,
    string? GuestFullName = null,
    string? GuestTckn = null,
    string? GuestPhone = null,
    string? GuestEmail = null,
    DateTime? GuestBirthDate = null,
    string? GuestGender = null,
    string? ApplicantName = null,
    string? ApplicantTckn = null,
    string? RejectionReason = null
);

public record TravelApplicationSummaryDto(int Total, int Approved, int Reviewing, int Rejected, int Waitlist);
