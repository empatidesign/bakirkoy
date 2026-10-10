namespace Nexora.Application.Features.Libraries;

public enum HardwareRequirement
{
    None,
    TwoDirectionalDevices,
    MagneticLock,
}

public record TemplateCapabilities(
    bool Entry,
    bool Exit,
    bool QrEntry,
    bool EntryDevice,
    bool ExitDevice,
    bool MagneticLock,
    bool SeatSelection,
    bool Reservation,
    bool ShortBreak,
    bool LongBreak,
    bool Queue,
    bool WaitingList,
    bool Points,
    bool Penalties);

public record TemplateDefinition(
    string Id,
    string DisplayName,
    string RecommendedFor,
    IReadOnlyList<HardwareRequirement> RequiredHardware,
    TemplateCapabilities Capabilities,
    IReadOnlyList<string> EditableSettingsKeys);

public static class OperationTemplates
{
    public const string FullBusyLibrary = "FULL_BUSY_LIBRARY";
    public const string QrEntryExitOnly = "QR_ENTRY_EXIT_ONLY";
    public const string EntryExitAndSeat = "ENTRY_EXIT_AND_SEAT";
    public const string SequentialSeat = "SEQUENTIAL_SEAT";

    private static readonly string[] CommonSettingsKeys =
    [
        nameof(Dtos.LibrarySettingsDto.DailyVisitCap),
        nameof(Dtos.LibrarySettingsDto.AutoCheckOutAfterMinutes),
        nameof(Dtos.LibrarySettingsDto.MinCheckoutAfterMinutes),
    ];

    public static readonly TemplateDefinition FullBusyLibraryDefinition = new(
        Id: FullBusyLibrary,
        DisplayName: "Tam Kapsamlı Yoğun Kütüphane",
        RecommendedFor: "Talebin yüksek olduğu, masaların sürekli dolduğu, kullanıcı sırasının oluştuğu ve masa devir hızının yönetilmesi gereken tesisler (Cebeci Millet Kıraathanesi referans uygulamadır).",
        RequiredHardware: [HardwareRequirement.TwoDirectionalDevices, HardwareRequirement.MagneticLock],
        Capabilities: new(
            Entry: true, Exit: true, QrEntry: true, EntryDevice: true, ExitDevice: true, MagneticLock: true,
            SeatSelection: true, Reservation: true, ShortBreak: true, LongBreak: true, Queue: true,
            WaitingList: true, Points: true, Penalties: true),
        EditableSettingsKeys:
        [
            .. CommonSettingsKeys,
            nameof(Dtos.LibrarySettingsDto.ReservationHoldWindowMinutes),
            nameof(Dtos.LibrarySettingsDto.DailyReservationLimitPerLibrary),
            nameof(Dtos.LibrarySettingsDto.BreakDurationMinutes),
            nameof(Dtos.LibrarySettingsDto.LongBreakDurationMinutes),
            nameof(Dtos.LibrarySettingsDto.MaxDailyBreaks),
            nameof(Dtos.LibrarySettingsDto.MaxDailyLongBreaks),
            nameof(Dtos.LibrarySettingsDto.ShortBreakCooldownMinutes),
            nameof(Dtos.LibrarySettingsDto.MinEntryBeforeBreakMinutes),
            nameof(Dtos.LibrarySettingsDto.QueueCallWindowMinutes),
            nameof(Dtos.LibrarySettingsDto.WalkInHoldMinutes),
        ]);

    public static readonly TemplateDefinition QrEntryExitOnlyDefinition = new(
        Id: QrEntryExitOnly,
        DisplayName: "QR Giriş-Çıkış Takip Sistemi",
        RecommendedFor: "Kitap kafeler, düşük yoğunluklu çalışma alanları ve yalnızca ziyaretçi kullanım oranlarının ölçülmek istendiği tesisler. Masa seçimi, mola ve sıra işlemleri bulunmaz.",
        RequiredHardware: [HardwareRequirement.None],
        Capabilities: new(
            Entry: true, Exit: true, QrEntry: true, EntryDevice: false, ExitDevice: false, MagneticLock: false,
            SeatSelection: false, Reservation: false, ShortBreak: false, LongBreak: false, Queue: false,
            WaitingList: false, Points: true, Penalties: false),
        EditableSettingsKeys:
        [
            .. CommonSettingsKeys,
        ]);

    public static readonly TemplateDefinition EntryExitAndSeatDefinition = new(
        Id: EntryExitAndSeat,
        DisplayName: "Giriş-Çıkış ve Masa Kullanım Sistemi",
        RecommendedFor: "Kullanıcıların masa seçmesinin istendiği ancak manyetik kilit, mola veya gelişmiş sıra sisteminin gerekli olmadığı kütüphaneler.",
        RequiredHardware: [HardwareRequirement.None],
        Capabilities: new(
            Entry: true, Exit: true, QrEntry: true, EntryDevice: false, ExitDevice: false, MagneticLock: false,
            SeatSelection: true, Reservation: false, ShortBreak: false, LongBreak: false, Queue: false,
            WaitingList: false, Points: true, Penalties: false),
        EditableSettingsKeys:
        [
            .. CommonSettingsKeys,
        ]);

    public static readonly TemplateDefinition SequentialSeatDefinition = new(
        Id: SequentialSeat,
        DisplayName: "Sıralı Masa Kullanım Sistemi",
        RecommendedFor: "Masa kapasitesinin takip edildiği ve yoğunluk oluştuğunda kullanıcıların sıraya alınmasının istendiği ancak tam kapsamlı mola ve gelişmiş bekleme süreçlerinin gerekli olmadığı tesisler.",
        RequiredHardware: [HardwareRequirement.None],
        Capabilities: new(
            Entry: true, Exit: true, QrEntry: true, EntryDevice: false, ExitDevice: false, MagneticLock: false,
            SeatSelection: true, Reservation: false, ShortBreak: false, LongBreak: false, Queue: true,
            WaitingList: false, Points: true, Penalties: false),
        EditableSettingsKeys:
        [
            .. CommonSettingsKeys,
            nameof(Dtos.LibrarySettingsDto.QueueCallWindowMinutes),
        ]);

    public static readonly IReadOnlyList<TemplateDefinition> All =
    [
        FullBusyLibraryDefinition,
        QrEntryExitOnlyDefinition,
        EntryExitAndSeatDefinition,
        SequentialSeatDefinition,
    ];

    public static TemplateDefinition? Find(string id) => All.FirstOrDefault(t => t.Id == id);

    public static bool HasRequiredHardware(TemplateDefinition template, bool hasTwoDirectionalDevices, bool hasMagneticLock)
    {
        foreach (var req in template.RequiredHardware)
        {
            var satisfied = req switch
            {
                HardwareRequirement.None => true,
                HardwareRequirement.TwoDirectionalDevices => hasTwoDirectionalDevices,
                HardwareRequirement.MagneticLock => hasMagneticLock,
                _ => false,
            };
            if (!satisfied) return false;
        }
        return true;
    }

    public static TemplateDefinition? FindBestFallback(bool hasTwoDirectionalDevices, bool hasMagneticLock)
        => All
            .Where(t => HasRequiredHardware(t, hasTwoDirectionalDevices, hasMagneticLock))
            .OrderByDescending(CapabilityRichness)
            .FirstOrDefault();

    private static int CapabilityRichness(TemplateDefinition t)
    {
        var c = t.Capabilities;
        var flags = new[] { c.SeatSelection, c.Reservation, c.ShortBreak, c.LongBreak, c.Queue, c.WaitingList, c.EntryDevice, c.ExitDevice, c.MagneticLock };
        return flags.Count(f => f);
    }
}
