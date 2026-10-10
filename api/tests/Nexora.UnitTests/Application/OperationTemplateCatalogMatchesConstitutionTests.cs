using Nexora.Application.Features.Libraries;
using Xunit;

namespace Nexora.UnitTests.Application;

public class OperationTemplateCatalogMatchesConstitutionTests
{
    [Fact]
    public void All_ContainsExactlyFourTemplates()
    {
        Assert.Equal(4, OperationTemplates.All.Count);
        Assert.Contains(OperationTemplates.All, t => t.Id == OperationTemplates.FullBusyLibrary);
        Assert.Contains(OperationTemplates.All, t => t.Id == OperationTemplates.QrEntryExitOnly);
        Assert.Contains(OperationTemplates.All, t => t.Id == OperationTemplates.EntryExitAndSeat);
        Assert.Contains(OperationTemplates.All, t => t.Id == OperationTemplates.SequentialSeat);
    }

    [Fact]
    public void QrEntry_AllTemplatesSupportIt()
    {
        foreach (var t in OperationTemplates.All)
            Assert.True(t.Capabilities.QrEntry, $"{t.Id} QR girişi desteklemeli (anayasa Bölüm 5)");
    }

    [Fact]
    public void EntryDevice_OnlyFullBusyRequiresIt()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.EntryDevice);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.EntryDevice);
        Assert.False(OperationTemplates.EntryExitAndSeatDefinition.Capabilities.EntryDevice);
        Assert.False(OperationTemplates.SequentialSeatDefinition.Capabilities.EntryDevice);
    }

    [Fact]
    public void MagneticLock_OnlyFullBusyRequiresIt()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.MagneticLock);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.MagneticLock);
        Assert.False(OperationTemplates.EntryExitAndSeatDefinition.Capabilities.MagneticLock);
        Assert.False(OperationTemplates.SequentialSeatDefinition.Capabilities.MagneticLock);
    }

    [Fact]
    public void SeatSelection_AllExceptQrOnlySupportIt()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.SeatSelection);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.SeatSelection);
        Assert.True(OperationTemplates.EntryExitAndSeatDefinition.Capabilities.SeatSelection);
        Assert.True(OperationTemplates.SequentialSeatDefinition.Capabilities.SeatSelection);
    }

    [Fact]
    public void Reservation_OnlyFullBusyIsAlwaysOn()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.Reservation);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.Reservation);
    }

    [Fact]
    public void Break_OnlyFullBusySupportsIt()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.ShortBreak);
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.LongBreak);
        foreach (var t in OperationTemplates.All.Where(t => t.Id != OperationTemplates.FullBusyLibrary))
        {
            Assert.False(t.Capabilities.ShortBreak, $"{t.Id} kısa mola desteklememeli (anayasa Bölüm 5)");
            Assert.False(t.Capabilities.LongBreak, $"{t.Id} uzun mola desteklememeli (anayasa Bölüm 5)");
        }
    }

    [Fact]
    public void Queue_OnlyFullBusyAndSequentialSupportIt()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.Queue);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.Queue);
        Assert.False(OperationTemplates.EntryExitAndSeatDefinition.Capabilities.Queue);
        Assert.True(OperationTemplates.SequentialSeatDefinition.Capabilities.Queue);
    }

    [Fact]
    public void WaitingList_OnlyFullBusyHasAdvancedWaitingList()
    {
        Assert.True(OperationTemplates.FullBusyLibraryDefinition.Capabilities.WaitingList);
        Assert.False(OperationTemplates.QrEntryExitOnlyDefinition.Capabilities.WaitingList);
        Assert.False(OperationTemplates.EntryExitAndSeatDefinition.Capabilities.WaitingList);
        Assert.False(OperationTemplates.SequentialSeatDefinition.Capabilities.WaitingList);
    }

    [Fact]
    public void Points_AllTemplatesSupportIt()
    {
        foreach (var t in OperationTemplates.All)
            Assert.True(t.Capabilities.Points, $"{t.Id} puan sistemini desteklemeli (anayasa Bölüm 5)");
    }

    [Fact]
    public void FullBusyLibrary_RequiresTwoDirectionalDevicesAndMagneticLock()
    {
        var required = OperationTemplates.FullBusyLibraryDefinition.RequiredHardware;
        Assert.Contains(HardwareRequirement.TwoDirectionalDevices, required);
        Assert.Contains(HardwareRequirement.MagneticLock, required);
    }

    [Fact]
    public void QrEntryExitOnly_RequiresNoHardware()
    {
        Assert.Single(OperationTemplates.QrEntryExitOnlyDefinition.RequiredHardware);
        Assert.Equal(HardwareRequirement.None, OperationTemplates.QrEntryExitOnlyDefinition.RequiredHardware[0]);
    }

    [Fact]
    public void EditableSettings_BreakKeysOnlyInFullBusyLibrary()
    {
        var breakKeys = new[] { "BreakDurationMinutes", "LongBreakDurationMinutes", "MaxDailyBreaks", "MaxDailyLongBreaks" };
        foreach (var t in OperationTemplates.All.Where(t => t.Id != OperationTemplates.FullBusyLibrary))
        {
            foreach (var key in breakKeys)
                Assert.DoesNotContain(key, t.EditableSettingsKeys);
        }
        foreach (var key in breakKeys)
            Assert.Contains(key, OperationTemplates.FullBusyLibraryDefinition.EditableSettingsKeys);
    }

    [Fact]
    public void Find_ReturnsNullForUnknownId()
    {
        Assert.Null(OperationTemplates.Find("NOT_A_REAL_TEMPLATE"));
    }

    [Fact]
    public void Find_ReturnsCorrectDefinitionForEachKnownId()
    {
        Assert.Same(OperationTemplates.FullBusyLibraryDefinition, OperationTemplates.Find(OperationTemplates.FullBusyLibrary));
        Assert.Same(OperationTemplates.QrEntryExitOnlyDefinition, OperationTemplates.Find(OperationTemplates.QrEntryExitOnly));
        Assert.Same(OperationTemplates.EntryExitAndSeatDefinition, OperationTemplates.Find(OperationTemplates.EntryExitAndSeat));
        Assert.Same(OperationTemplates.SequentialSeatDefinition, OperationTemplates.Find(OperationTemplates.SequentialSeat));
    }
}
