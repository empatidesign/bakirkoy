using Nexora.Application.Features.Events.Dtos;
using Nexora.Application.Features.Facilities.Dtos;
using Nexora.Application.Features.Seda.Dtos;
using Nexora.Application.Features.Travels.Dtos;

namespace Nexora.Application.Common.Interfaces;

public interface IExcelService
{
    byte[] BuildTravelApplicationExport(IReadOnlyList<TravelApplicationDto> items, string reportTitle);
    byte[] BuildEventApplicationExport(IReadOnlyList<ApplicationDto> items, string reportTitle, string? sessionInfo);
    byte[] BuildTravelAttendanceExport(TravelAttendanceRosterDto roster);
    byte[] BuildEventAttendanceExport(IReadOnlyList<ActivityDto> items, string eventName);
    byte[] BuildSedaApplicationExport(IReadOnlyList<SedaApplicationDto> items, string reportTitle);
    byte[] BuildSedaEducationRecordExport(IReadOnlyList<SedaEducationRecordDto> items, string reportTitle);
    byte[] BuildFacilityApplicationExport(IReadOnlyList<FacilityApplicationDto> items, string reportTitle, string moduleLabel);
    byte[] BuildFacilityRosterExport(IReadOnlyList<FacilityRegistrationDto> items, string groupName, string moduleLabel);
}
