using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Events.Validators;
using Xunit;
using FluentValidation.TestHelper;

namespace Nexora.UnitTests.Application;

// 2026-08-02 kullanıcı bildirimi: tek seans veya tekrarlı (recurring) seans üretiminde
// bitiş saatinin başlangıçtan sonra olduğu hiç doğrulanmıyordu.
public class SessionFormRequestValidatorTests
{
    private readonly SessionFormRequestValidator validator = new();

    private static SessionFormRequest SingleModeRequest(string startTime, string endTime) => new(
        EventId: Guid.NewGuid(),
        HallId: null,
        Mode: "single",
        Date: DateTime.UtcNow.Date.AddDays(1),
        StartTime: startTime,
        EndTime: endTime,
        StartDate: default,
        EndDate: default,
        DayPlans: [],
        Capacity: 10,
        ReserveCapacity: 2,
        Instructor: "Test Eğitmen",
        InstructorId: Guid.NewGuid().ToString(),
        InstructorPhone: null,
        InstructorEmail: null,
        EmergencyPhone: null,
        IsActive: true);

    private static SessionFormRequest RecurringModeRequest(List<SessionDayPlan> dayPlans) => new(
        EventId: Guid.NewGuid(),
        HallId: null,
        Mode: "recurring",
        Date: default,
        StartTime: "",
        EndTime: "",
        StartDate: DateTime.UtcNow.Date.AddDays(1),
        EndDate: DateTime.UtcNow.Date.AddDays(30),
        DayPlans: dayPlans,
        Capacity: 10,
        ReserveCapacity: 2,
        Instructor: "Test Eğitmen",
        InstructorId: Guid.NewGuid().ToString(),
        InstructorPhone: null,
        InstructorEmail: null,
        EmergencyPhone: null,
        IsActive: true);

    [Fact]
    public void Tek_seansta_bitis_saati_baslangictan_once_ise_hata_verir()
    {
        var req = SingleModeRequest("13:00", "12:00");
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndTime)
            .WithErrorMessage("Bitiş saati başlangıç saatinden sonra olmalıdır.");
    }

    [Fact]
    public void Tek_seansta_bitis_saati_baslangica_esit_ise_hata_verir()
    {
        var req = SingleModeRequest("13:00", "13:00");
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor(x => x.EndTime);
    }

    [Fact]
    public void Tek_seansta_bitis_saati_baslangictan_sonra_ise_gecerlidir()
    {
        var req = SingleModeRequest("13:00", "15:00");
        var result = validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor(x => x.EndTime);
    }

    [Fact]
    public void Tekrarli_seansta_bir_gunun_slotunda_bitis_baslangictan_once_ise_hata_verir()
    {
        var dayPlans = new List<SessionDayPlan>
        {
            new("monday", [new SessionSlot("10:00", "11:00"), new SessionSlot("14:00", "13:00")]),
        };
        var req = RecurringModeRequest(dayPlans);
        var result = validator.TestValidate(req);
        result.ShouldHaveValidationErrorFor("DayPlans[0].Slots[1]");
    }

    [Fact]
    public void Tekrarli_seansta_tum_slotlar_gecerliyse_hata_vermez()
    {
        var dayPlans = new List<SessionDayPlan>
        {
            new("monday", [new SessionSlot("10:00", "11:00"), new SessionSlot("14:00", "15:00")]),
        };
        var req = RecurringModeRequest(dayPlans);
        var result = validator.TestValidate(req);
        result.ShouldNotHaveValidationErrorFor("DayPlans[0].Slots[0]");
        result.ShouldNotHaveValidationErrorFor("DayPlans[0].Slots[1]");
    }
}
