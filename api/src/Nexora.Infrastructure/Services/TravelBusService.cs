using System.Globalization;
using Nexora.Domain.Common;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Nexora.Application.Common;
using Nexora.Application.Common.ApiResponse;
using Nexora.Application.Common.Exceptions;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Features.Travels;
using Nexora.Application.Features.Travels.Dtos;
using Nexora.Domain.Entities.Travels;
using Nexora.Domain.Enums;

namespace Nexora.Infrastructure.Services;

public class TravelBusService(IUnitOfWork uow, IActivityLogger log, IAuditService audit, IParticipantNotificationService participantNotify) : ITravelBusService
{
    public async Task<PagedResult<TravelBusDto>> GetPagedAsync(TravelBusListParams p, CancellationToken ct)
        => await MapPageAsync(await uow.TravelBuses.GetPagedAsync(p, ct), ct);

    public async Task<List<TravelBusDto>> GetByTravelAsync(Guid travelId, CancellationToken ct)
    {
        var items = await uow.TravelBuses.GetByTravelAsync(travelId, ct);
        var names = await uow.TravelBuses.GetNearestTravelNamesAsync(items.Select(b => b.Id), ct);
        return items.Select(b => Map(b, names.GetValueOrDefault(b.Id))).ToList();
    }

    public async Task<List<TravelBusDto>> GetAvailableAsync(Guid? forTravelId, DateTime? startDate, DateTime? endDate, CancellationToken ct)
    {
        var items = await uow.TravelBuses.GetAvailableAsync(forTravelId, startDate, endDate, ct);
        return items.Select(b => Map(b, null)).ToList();
    }

    public async Task<TravelBusSummaryDto> GetSummaryAsync(Guid? travelId, CancellationToken ct)
    {
        var (buses, capacity, occupied, activeTravels) = await uow.TravelBuses.GetSummaryAsync(travelId, ct);
        return new TravelBusSummaryDto(buses, capacity, occupied, activeTravels);
    }

    public async Task<TravelBusDto> GetByIdAsync(Guid id, CancellationToken ct)
    {
        var b = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");
        var names = await uow.TravelBuses.GetNearestTravelNamesAsync([b.Id], ct);
        return Map(b, names.GetValueOrDefault(b.Id));
    }

    public async Task<TravelBusDto> CreateAsync(TravelBusFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(CreateAsync), new { req.Name });

        if (req.VehicleType == "capacity")
        {
            var cap = Math.Max(0, req.Capacity ?? 0);
            var capBus = TravelBus.Create(req.Name, req.PlateNumber ?? "", "capacity", req.TemplateId, cap, RawOrEmpty(req.SeatStates), 0, null);
            await uow.TravelBuses.AddAsync(capBus, ct);
            await uow.SaveChangesAsync(ct);
            return Map(capBus, null);
        }

        var seatJson = RawOrEmpty(req.SeatStates);
        var (capacity, occupied) = BusSeatMath.FromSeatStates(seatJson, req.TemplateId);

        var bus = TravelBus.Create(req.Name, req.PlateNumber ?? "", "bus", req.TemplateId, capacity, seatJson, occupied, null);

        await uow.TravelBuses.AddAsync(bus, ct);
        await uow.SaveChangesAsync(ct);

        return Map(bus, null);
    }

    public async Task<TravelBusDto> UpdateAsync(Guid id, TravelBusFormRequest req, CancellationToken ct)
    {
        log.LogStep(nameof(UpdateAsync), new { id });

        var bus = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        if (req.VehicleType == "capacity")
        {
            var cap = Math.Max(0, req.Capacity ?? bus.Capacity);
            bus.Update(req.Name, req.PlateNumber ?? "", "capacity", bus.TemplateId, cap, bus.SeatStatesJson, bus.OccupiedCount);
            uow.TravelBuses.Update(bus);
            await uow.SaveChangesAsync(ct);
            var capNames = await uow.TravelBuses.GetNearestTravelNamesAsync([bus.Id], ct);
            return Map(bus, capNames.GetValueOrDefault(bus.Id));
        }

        var oldSeatJson = bus.SeatStatesJson;
        var seatJson = RawOrEmpty(req.SeatStates);
        var (capacity, occupied) = BusSeatMath.FromSeatStates(seatJson, req.TemplateId);

        bus.Update(req.Name, req.PlateNumber ?? "", "bus", req.TemplateId, capacity, seatJson, occupied);

        uow.TravelBuses.Update(bus);
        await uow.SaveChangesAsync(ct);

        // NOT: Ham string karsilastirmasi (oldSeatJson != seatJson) kullanilmiyor. Ayni
        // jsonb kanonik siralama farki HallService'teki #10 hatasiyla ayni kok nedene sahip
        // (bkz. NEXORA_KAPSAMLI_HATA_RAPORU_2026-08-26.md #18). JsonComparisonHelper anahtar
        // sirasindan bagimsiz semantik karsilastirma yapar.
        if (!JsonComparisonHelper.JsonEquals(oldSeatJson, seatJson))
            await PropagateBusSeatChangeAsync(bus.Id, ct);

        var names = await uow.TravelBuses.GetNearestTravelNamesAsync([bus.Id], ct);
        return Map(bus, names.GetValueOrDefault(bus.Id));
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var bus = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        await uow.TravelBuses.RemoveAssignmentsForBusAsync(id, ct);
        uow.TravelBuses.Delete(bus);
        await uow.SaveChangesAsync(ct);
    }

    public async Task<TravelBusDto> ToggleStatusAsync(Guid id, CancellationToken ct)
    {
        var bus = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        if (bus.IsActive) bus.Deactivate(); else bus.Activate();
        uow.TravelBuses.Update(bus);
        await uow.SaveChangesAsync(ct);

        var names = await uow.TravelBuses.GetNearestTravelNamesAsync([bus.Id], ct);
        return Map(bus, names.GetValueOrDefault(bus.Id));
    }

    public async Task<TravelBusDto> CloneAsync(Guid id, CancellationToken ct)
    {
        var bus = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        var clone = TravelBus.Create(
            $"{bus.Name} (Kopya)", bus.PlateNumber, bus.VehicleType, bus.TemplateId, bus.Capacity,
            bus.IsCapacityOnly ? "{}" : bus.SeatStatesJson, 0, null, bus.Id);

        await uow.TravelBuses.AddAsync(clone, ct);
        await uow.SaveChangesAsync(ct);

        return Map(clone, null);
    }

    public async Task<TravelBusUsageHistoryDto> GetUsageHistoryAsync(Guid id, CancellationToken ct)
    {
        var bus = await uow.TravelBuses.GetByIdAsync(id, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        string? sourceBusName = null;
        if (bus.SourceBusId.HasValue)
        {
            var source = await uow.TravelBuses.GetByIdAsync(bus.SourceBusId.Value, ct);
            sourceBusName = source?.Name;
        }

        var clones = await uow.TravelBuses.GetBySourceBusIdAsync(bus.Id, ct);
        var relatedBusIds = new List<Guid> { bus.Id };
        relatedBusIds.AddRange(clones.Select(c => c.Id));

        var assignments = await uow.TravelBuses.GetAllAssignmentsForBusesAsync(relatedBusIds, ct);
        var travelIds = assignments.Select(a => a.TravelId).Distinct().ToList();
        var travels = travelIds.Count == 0
            ? []
            : await uow.Travels.FindAsync(t => travelIds.Contains(t.Id), ct);

        var entries = assignments
            .Select(a => (Assignment: a, Travel: travels.FirstOrDefault(t => t.Id == a.TravelId)))
            .Where(x => x.Travel is not null)
            .Select(x => new TravelBusUsageEntryDto(
                x.Travel!.Id, x.Travel.Name, x.Travel.Code, x.Travel.StartDate, x.Travel.EndDate, x.Assignment.BusId != bus.Id))
            .OrderByDescending(e => e.StartDate)
            .ToList();

        return new TravelBusUsageHistoryDto(bus.Id, bus.Name, bus.SourceBusId, sourceBusName, entries);
    }

    public async Task<List<TravelBusSeatingDto>> GetTravelSeatingAsync(Guid travelId, CancellationToken ct)
    {
        var assignments = await uow.TravelBuses.GetAssignmentsByTravelAsync(travelId, ct);
        if (assignments.Count == 0) return [];

        var result = new List<TravelBusSeatingDto>();
        foreach (var a in assignments)
        {
            var bus = await uow.TravelBuses.GetByIdAsync(a.BusId, ct);
            if (bus is null) continue;

            if (bus.IsCapacityOnly)
            {
                var activePassengers = await uow.TravelApplications.GetActivePassengersByBusAsync(travelId, a.BusId, ct);
                var passengerNames = await uow.TravelApplications.GetSeatedPassengerNamesAsync(travelId, a.BusId, ct);
                var capNameBySeat = passengerNames.ToDictionary(x => x.SeatNumber, x => x.FullName);
                var capOccupants = activePassengers.Select(p => new TravelSeatOccupantDto(
                    p.SeatNumber ?? "", p.Gender,
                    p.SeatNumber is not null && capNameBySeat.TryGetValue(p.SeatNumber, out var name) ? name : null)).ToList();
                result.Add(new TravelBusSeatingDto(
                    bus.Id, bus.Name, bus.PlateNumber, bus.TemplateId, bus.Capacity,
                    ToElement(new JsonObject()), [], capOccupants, bus.VehicleType, activePassengers.Count));
                continue;
            }

            var map = ParseSeatMap(a.SeatStatesJson ?? bus.SeatStatesJson);
            var locks = BusSeatMath.LockedSeats(bus.SeatStatesJson);
            foreach (var (seatId, status) in locks) SetStatus(map, seatId, status);

            var labelToId = BusSeatLayout.LabelToId(bus.TemplateId);
            var seated = await uow.TravelApplications.GetSeatedPassengersAsync(travelId, a.BusId, ct);
            var seatedNames = await uow.TravelApplications.GetSeatedPassengerNamesAsync(travelId, a.BusId, ct);
            var nameBySeat = seatedNames.ToDictionary(x => x.SeatNumber, x => x.FullName);
            var occupants = new List<TravelSeatOccupantDto>();
            var seenLabels = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in seated)
            {
                if (p.SeatNumber is null) continue;
                if (labelToId.TryGetValue(p.SeatNumber, out var seatId) && !locks.ContainsKey(seatId))
                    SetStatus(map, seatId, "occupied");
                occupants.Add(new TravelSeatOccupantDto(
                    p.SeatNumber, p.Gender,
                    nameBySeat.TryGetValue(p.SeatNumber, out var passengerName) ? passengerName : null));
                seenLabels.Add(p.SeatNumber);
            }
            result.Add(new TravelBusSeatingDto(
                bus.Id, bus.Name, bus.PlateNumber, bus.TemplateId, bus.Capacity,
                ToElement(map), [.. locks.Keys], occupants, bus.VehicleType, seenLabels.Count));
        }

        return [.. result.OrderBy(r => r.Name)];
    }

    public async Task SaveTravelBusSeatingAsync(Guid travelId, Guid busId, SaveTravelSeatingRequest req, CancellationToken ct)
    {
        var assignment = await uow.TravelBuses.GetAssignmentAsync(travelId, busId, ct)
            ?? throw new NotFoundException("Bu geziye atanmış otobüs bulunamadı.", "TRAVEL_BUS_ASSIGNMENT_NOT_FOUND");
        var bus = await uow.TravelBuses.GetByIdAsync(busId, ct)
            ?? throw new NotFoundException("Otobüs bulunamadı.", "TRAVEL_BUS_NOT_FOUND");

        if (bus.IsCapacityOnly)
            throw new ConflictException("Numarasız (kontenjanlı) araçlarda koltuk düzeni yoktur.", "VEHICLE_HAS_NO_SEATS");

        var incoming = ParseSeatMap(RawOrEmpty(req.SeatStates));
        var locks = BusSeatMath.LockedSeats(bus.SeatStatesJson);

        foreach (var (seatId, status) in locks)
        {
            var incomingStatus = StatusOf(incoming, seatId);
            if (incomingStatus is not null && incomingStatus != status)
                throw new ConflictException("Otobüste kapalı, şoför veya rehber olarak ayrılmış koltuklar gezi bazında değiştirilemez.", "BUS_LOCKED_SEAT");
        }
        foreach (var (seatId, status) in locks) SetStatus(incoming, seatId, status);

        assignment.SeatStatesJson = incoming.ToJsonString();
        await uow.SaveChangesAsync(ct);

        await audit.LogAsync(new AuditEntry
        {
            Action = AuditAction.Update,
            EntityType = "TravelBusSeating",
            EntityId = travelId,
            Module = "Travels",
            Description = $"Gezi koltuk düzeni güncellendi (otobüs: {bus.Name}).",
        }, ct);
    }

    public async Task<BusSeatChangeImpactDto> PropagateBusSeatChangeAsync(Guid busId, CancellationToken ct)
    {
        var bus = await uow.TravelBuses.GetByIdAsync(busId, ct);
        if (bus is null) return new BusSeatChangeImpactDto(0, 0, 0, 0);

        var locks = BusSeatMath.LockedSeats(bus.SeatStatesJson);
        var today = TurkeyTime.TodayDate();
        var assignments = await uow.TravelBuses.GetUpcomingAssignmentsForBusAsync(busId, today, ct);
        if (assignments.Count == 0) return new BusSeatChangeImpactDto(0, 0, 0, 0);

        var passengerOrder = BusSeatLayout.PassengerSeatIdsInOrder(bus.TemplateId);
        var segments = BusSeatLayout.AdjacencyIdSegments(bus.TemplateId);
        var idToLabel = BusSeatLayout.IdToLabel(bus.TemplateId);
        var labelToId = BusSeatLayout.LabelToId(bus.TemplateId);

        var travelIds = assignments.Select(a => a.TravelId).Distinct().ToList();
        var travels = (await uow.Travels.FindAsync(t => travelIds.Contains(t.Id), ct)).ToDictionary(t => t.Id);

        int affected = 0, reassigned = 0, manualPending = 0, capacityReduced = 0;
        var audits = new List<AuditEntry>();
        var moveNotices = new List<(Guid Pid, string Context, List<string> Old, List<string?> New, bool Manual)>();

        foreach (var a in assignments)
        {
            if (!travels.TryGetValue(a.TravelId, out var travel)) continue;

            var map = ParseSeatMap(a.SeatStatesJson ?? bus.SeatStatesJson);
            var changed = false;

            foreach (var (seatId, status) in locks)
                if (StatusOf(map, seatId) != status) { SetStatus(map, seatId, status); changed = true; }

            var seated = await uow.TravelApplications.GetSeatedPassengersAsync(a.TravelId, busId, ct);
            var displaced = seated
                .Where(p => p.SeatNumber is not null
                    && labelToId.TryGetValue(p.SeatNumber, out var sid) && locks.ContainsKey(sid))
                .ToList();

            if (displaced.Count > 0)
            {
                var taken = new HashSet<string>(locks.Keys);
                foreach (var p in seated)
                    if (!displaced.Contains(p) && p.SeatNumber is not null && labelToId.TryGetValue(p.SeatNumber, out var sid))
                        taken.Add(sid);
                foreach (var seatId in passengerOrder)
                    if (StatusOf(map, seatId) is "occupied" or "reserved" or "blocked")
                        taken.Add(seatId);

                var free = new HashSet<string>(passengerOrder.Where(id => !taken.Contains(id)));

                foreach (var group in displaced.GroupBy(p => p.ParticipantId).OrderByDescending(g => g.Count()))
                {
                    var members = group.ToList();
                    var oldLabels = members.Select(m => m.SeatNumber!).ToList();
                    var block = FindAdjacentFreeBlock(segments, free, members.Count);
                    var newLabels = new List<string?>();

                    if (block is not null)
                    {
                        for (var i = 0; i < members.Count; i++)
                        {
                            members[i].AssignSeat(busId, idToLabel[block[i]]);
                            SetStatus(map, block[i], "occupied");
                            free.Remove(block[i]);
                            newLabels.Add(idToLabel[block[i]]);
                            reassigned++;
                        }
                    }
                    else
                    {
                        foreach (var m in members)
                        {
                            var seatId = passengerOrder.FirstOrDefault(free.Contains);
                            if (seatId is not null)
                            {
                                m.AssignSeat(busId, idToLabel[seatId]);
                                SetStatus(map, seatId, "occupied");
                                free.Remove(seatId);
                                newLabels.Add(idToLabel[seatId]);
                                reassigned++;
                            }
                            else
                            {
                                m.AssignSeat(busId, null);
                                newLabels.Add(null);
                                manualPending++;
                            }
                        }
                    }

                    audits.Add(new AuditEntry
                    {
                        Action = AuditAction.Update,
                        EntityType = "TravelApplicationPassenger",
                        EntityId = a.TravelId,
                        Module = "Travels",
                        Level = newLabels.Any(l => l is null) ? AuditLogLevel.Warning : AuditLogLevel.Info,
                        Description = $"Otobüs koltuk değişikliği ({travel.Name}): {string.Join(", ", oldLabels)} → {string.Join(", ", newLabels.Select(l => l ?? "manuel yer bekliyor"))}.",
                    });

                    moveNotices.Add((group.Key, $"{travel.Name} gezisi", oldLabels, newLabels, newLabels.Any(l => l is null)));
                }
                changed = true;
            }

            var openSeats = BusSeatMath.OpenSeats(map.ToJsonString(), bus.TemplateId);
            if (travel.Capacity > openSeats)
            {
                capacityReduced += travel.Capacity - openSeats;
                travel.SetCapacity(openSeats);
                uow.Travels.Update(travel);
                changed = true;
            }

            if (changed)
            {
                a.SeatStatesJson = map.ToJsonString();
                affected++;
            }
        }

        if (affected > 0) await uow.SaveChangesAsync(ct);
        foreach (var entry in audits) await audit.LogAsync(entry, ct);
        foreach (var (pid, context, oldLabels, newLabels, manual) in moveNotices)
            await participantNotify.NotifySeatMoveAsync(pid, context, oldLabels, newLabels, manual, ct);

        return new BusSeatChangeImpactDto(affected, reassigned, manualPending, capacityReduced);
    }

    private static List<string>? FindAdjacentFreeBlock(List<List<string>> segments, HashSet<string> free, int count)
    {
        if (count <= 0) return null;
        foreach (var seg in segments)
            for (var i = 0; i + count <= seg.Count; i++)
            {
                var window = seg.GetRange(i, count);
                if (window.All(free.Contains)) return window;
            }
        return null;
    }

    private static JsonObject ParseSeatMap(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try { return JsonNode.Parse(json)?.AsObject() ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }

    private static string? StatusOf(JsonObject map, string seatId)
        => map[seatId] is JsonObject o && o.TryGetPropertyValue("status", out var s) ? s?.GetValue<string>() : null;

    private static void SetStatus(JsonObject map, string seatId, string status)
    {
        if (map[seatId] is JsonObject o) o["status"] = status;
        else map[seatId] = new JsonObject { ["status"] = status };
    }

    private static JsonElement ToElement(JsonObject map)
        => JsonDocument.Parse(map.ToJsonString()).RootElement.Clone();

    private async Task<PagedResult<TravelBusDto>> MapPageAsync(PagedResult<TravelBus> paged, CancellationToken ct)
    {
        var names = await uow.TravelBuses.GetNearestTravelNamesAsync(paged.Items.Select(b => b.Id), ct);
        return new PagedResult<TravelBusDto>
        {
            Items = paged.Items.Select(b => Map(b, names.GetValueOrDefault(b.Id))).ToList(),
            Total = paged.Total,
            Page = paged.Page,
            Limit = paged.Limit,
        };
    }

    private static TravelBusDto Map(TravelBus b, string? travelName)
        => new(b.Id, travelName, b.Name, b.PlateNumber, b.TemplateId, b.Capacity, ParseJson(b.SeatStatesJson), b.OccupiedCount, b.IsActive, b.VehicleType, b.SourceBusId);

    public async Task<(byte[] Bytes, string FileName)> ExportSeatPlanWordAsync(Guid travelId, CancellationToken ct)
    {
        var travel = await uow.Travels.GetByIdAsync(travelId, ct)
            ?? throw new NotFoundException("Gezi bulunamadı.", "TRAVEL_NOT_FOUND");

        var assignments = await uow.TravelBuses.GetAssignmentsByTravelAsync(travelId, ct);
        var trCulture = new CultureInfo("tr-TR");

        using var mem = new MemoryStream();
        using (var doc = WordprocessingDocument.Create(mem, WordprocessingDocumentType.Document))
        {
            var main = doc.AddMainDocumentPart();
            main.Document = new Document(new Body());
            var body = main.Document.Body!;

            body.Append(WordHeadingParagraph(travel.Name));

            var startStr = travel.StartDate.ToString("dd MMMM yyyy", trCulture);
            var endStr = travel.EndDate.Date != travel.StartDate.Date
                ? $" – {travel.EndDate.ToString("dd MMMM yyyy", trCulture)}"
                : "";
            body.Append(WordSubtitleParagraph($"Koltuk Oturma Planı  ·  {startStr}{endStr}"));
            body.Append(WordSpaceParagraph(80));

            foreach (var assignment in assignments.OrderBy(a => a.BusId))
            {
                var bus = await uow.TravelBuses.GetByIdAsync(assignment.BusId, ct);
                if (bus is null) continue;

                if (bus.IsCapacityOnly)
                {
                    var namesOnly = await uow.TravelApplications.GetActivePassengersByBusAsync(travelId, assignment.BusId, ct);
                    var partIds = namesOnly.Select(p => p.ParticipantId).Distinct().ToList();
                    var parts = partIds.Count == 0
                        ? new Dictionary<Guid, string>()
                        : (await uow.Participants.FindAsync(p => partIds.Contains(p.Id), ct)).ToDictionary(p => p.Id, p => p.FullName);

                    body.Append(WordBusTitleParagraph($"{bus.Name}  ·  {bus.PlateNumber}  ·  {namesOnly.Count}/{bus.Capacity} kişi (numarasız kontenjan)"));
                    foreach (var p in namesOnly)
                    {
                        var name = parts.GetValueOrDefault(p.ParticipantId, "—");
                        body.Append(new Paragraph(new Run(new RunProperties(new FontSize { Val = "20" }), new Text($"• {name}"))));
                    }
                    body.Append(WordSpaceParagraph(160));
                    continue;
                }

                var (rows, left, right, back) = TemplateShape(bus.TemplateId);
                if (rows == 0) continue;

                var idToLabel = BusSeatLayout.IdToLabel(bus.TemplateId);
                var locks = BusSeatMath.LockedSeats(bus.SeatStatesJson);
                var seated = await uow.TravelApplications.GetSeatedPassengerNamesAsync(travelId, assignment.BusId, ct);
                var nameMap = seated.ToDictionary(s => s.SeatNumber, s => s);

                var totalCols = left + 1 + right;
                const uint usableWidth = 14400u;
                var colWidth = usableWidth / (uint)totalCols;

                body.Append(WordBusTitleParagraph($"{bus.Name}  ·  {bus.PlateNumber}  ·  {seated.Count} yolcu"));

                var table = new Table(new TableProperties(
                    new TableWidth { Width = usableWidth.ToString(), Type = TableWidthUnitValues.Dxa },
                    new TableBorders(
                        new TopBorder { Val = BorderValues.Single, Size = 4 },
                        new BottomBorder { Val = BorderValues.Single, Size = 4 },
                        new LeftBorder { Val = BorderValues.Single, Size = 4 },
                        new RightBorder { Val = BorderValues.Single, Size = 4 },
                        new InsideHorizontalBorder { Val = BorderValues.Single, Size = 4 },
                        new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 }
                    )
                ));

                var tblGrid = new TableGrid();
                for (var c = 0; c < totalCols; c++)
                    tblGrid.Append(new GridColumn { Width = colWidth.ToString() });
                table.Append(tblGrid);

                table.Append(FrontDoorRow(totalCols, usableWidth));

                for (var row = 1; row <= rows; row++)
                {
                    var tr = new TableRow();
                    for (var col = 0; col < totalCols; col++)
                    {
                        if (col == left)
                        {
                            tr.Append(WordCell("", "", "F3F4F6", colWidth));
                        }
                        else
                        {
                            var seatId = col < left ? $"L-{row}-{col}" : $"R-{row}-{col - left - 1}";
                            var (label, name, color) = SeatInfo(seatId, idToLabel, locks, nameMap);
                            tr.Append(WordCell(label, name, color, colWidth));
                        }
                    }
                    table.Append(tr);
                }

                if (back > 0)
                {
                    var tr = new TableRow();
                    for (var i = 0; i < totalCols; i++)
                    {
                        if (i < back)
                        {
                            var seatId = $"B-{i}";
                            var (label, name, color) = SeatInfo(seatId, idToLabel, locks, nameMap);
                            tr.Append(WordCell(label, name, color, colWidth));
                        }
                        else
                        {
                            tr.Append(WordCell("", "", "FFFFFF", colWidth));
                        }
                    }
                    table.Append(tr);
                }

                body.Append(table);
                body.Append(WordSpaceParagraph(60));
                body.Append(BuildLegendTable());
                body.Append(WordSpaceParagraph(160));
            }

            body.Append(new SectionProperties(
                new PageSize { Width = 15840, Height = 12240, Orient = PageOrientationValues.Landscape },
                new PageMargin { Top = 720, Bottom = 720, Left = 720, Right = 720 }
            ));

            main.Document.Save();
        }

        var safeDate = travel.StartDate.ToString("yyyyMMdd");
        var safeName = Regex.Replace(travel.Name, @"[^\w\s]", "", RegexOptions.None, TimeSpan.FromSeconds(1))
                            .Trim().Replace(' ', '-');
        return (mem.ToArray(), $"{safeName}-koltuk-plani-{safeDate}.docx");
    }

    private static (string Label, string Name, string Color) SeatInfo(
        string seatId,
        Dictionary<string, string> idToLabel,
        Dictionary<string, string> locks,
        Dictionary<string, SeatedPassengerNameDto> nameMap)
    {
        if (locks.TryGetValue(seatId, out var lockStatus))
        {
            if (lockStatus == "hidden") return ("", "", "FFFFFF");
            var label = idToLabel.GetValueOrDefault(seatId, seatId);
            var color = lockStatus is "driver" or "guide" ? "EDE9FE" : "FEE2E2";
            var name = lockStatus switch { "driver" => "Şoför", "guide" => "Rehber", _ => "—" };
            return (label, name, color);
        }

        if (!idToLabel.TryGetValue(seatId, out var seatLabel))
            return (seatId, "", "FFFFFF");

        if (nameMap.TryGetValue(seatLabel, out var passenger))
        {
            var color = passenger.Gender == "female" ? "FCE7F3" : "DBEAFE";
            return (seatLabel, passenger.FullName, color);
        }

        return (seatLabel, "Boş", "FFFFFF");
    }

    private static Paragraph WordHeadingParagraph(string text) =>
        new(
            new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
            new Run(new RunProperties(new Bold(), new FontSize { Val = "44" }), new Text(text))
        );

    private static Paragraph WordSubtitleParagraph(string text) =>
        new(
            new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
            new Run(new RunProperties(new FontSize { Val = "24" }, new Color { Val = "555555" }), new Text(text))
        );

    private static Paragraph WordBusTitleParagraph(string text) =>
        new(new Run(new RunProperties(new Bold(), new FontSize { Val = "22" }), new Text(text)));

    private static Paragraph WordSpaceParagraph(int spacingAfter) =>
        new(new ParagraphProperties(new SpacingBetweenLines { After = spacingAfter.ToString() }));

    private static TableRow FrontDoorRow(int totalCols, uint usableWidth)
    {
        var row = new TableRow();
        var cell = new TableCell(
            new TableCellProperties(
                new TableCellWidth { Width = usableWidth.ToString(), Type = TableWidthUnitValues.Dxa },
                new GridSpan { Val = totalCols },
                new Shading { Fill = "1E3A5F", Color = "auto", Val = ShadingPatternValues.Clear }
            ),
            new Paragraph(
                new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
                new Run(
                    new RunProperties(new Bold(), new Color { Val = "FFFFFF" }, new FontSize { Val = "18" }),
                    new Text("↑   ÖN KAPI   ↑")
                )
            )
        );
        row.Append(cell);
        return row;
    }

    private static Table BuildLegendTable()
    {
        (string Color, string Label)[] items =
        [
            ("DBEAFE", "Erkek"),
            ("FCE7F3", "Kadın"),
            ("FFFFFF", "Boş"),
            ("EDE9FE", "Şoför / Rehber"),
            ("FEE2E2", "Kapalı"),
        ];

        var table = new Table(new TableProperties(
            new TableWidth { Width = "0", Type = TableWidthUnitValues.Auto },
            new TableBorders(
                new TopBorder { Val = BorderValues.Single, Size = 4 },
                new BottomBorder { Val = BorderValues.Single, Size = 4 },
                new LeftBorder { Val = BorderValues.Single, Size = 4 },
                new RightBorder { Val = BorderValues.Single, Size = 4 },
                new InsideHorizontalBorder { Val = BorderValues.None },
                new InsideVerticalBorder { Val = BorderValues.Single, Size = 4 }
            )
        ));

        var tr = new TableRow();
        foreach (var (color, label) in items)
        {
            tr.Append(new TableCell(
                new TableCellProperties(
                    new TableCellWidth { Type = TableWidthUnitValues.Auto },
                    new Shading { Fill = color, Color = "auto", Val = ShadingPatternValues.Clear }
                ),
                new Paragraph(
                    new ParagraphProperties(new Justification { Val = JustificationValues.Center }),
                    new Run(new RunProperties(new FontSize { Val = "16" }), new Text($"  {label}  "))
                )
            ));
        }
        table.Append(tr);
        return table;
    }

    private static TableCell WordCell(string line1, string line2, string hexColor, uint widthDxa)
    {
        var pPr = new ParagraphProperties(
            new Justification { Val = JustificationValues.Center },
            new SpacingBetweenLines { Before = "40", After = "40" }
        );
        var para = new Paragraph();
        para.Append(pPr);

        if (!string.IsNullOrEmpty(line1))
            para.Append(new Run(new RunProperties(new Bold(), new FontSize { Val = "18" }), new Text(line1)));

        if (!string.IsNullOrEmpty(line2))
        {
            if (!string.IsNullOrEmpty(line1)) para.Append(new Run(new Break()));
            var nameRpr = new RunProperties(new FontSize { Val = "14" });
            if (line2 == "Boş") nameRpr.Append(new Color { Val = "BBBBBB" });
            para.Append(new Run(nameRpr, new Text(line2)));
        }
        else if (string.IsNullOrEmpty(line1))
        {
            para.Append(new Run(new Text("")));
        }

        return new TableCell(
            new TableCellProperties(
                new TableCellWidth { Type = TableWidthUnitValues.Dxa, Width = widthDxa.ToString() },
                new Shading { Fill = hexColor, Color = "auto", Val = ShadingPatternValues.Clear }
            ),
            para
        );
    }

    private static (int Rows, int Left, int Right, int Back) TemplateShape(string? templateId) => templateId switch
    {
        "intercity_2plus1_39" => (13, 1, 2, 4),
        "tour_2plus2_44" => (11, 2, 2, 5),
        "minibus_2plus1_20" => (6, 1, 2, 2),
        "midibus_2plus2_30" => (7, 2, 2, 2),
        _ => (0, 0, 0, 0),
    };

    private static string RawOrEmpty(JsonElement el)
        => el.ValueKind is JsonValueKind.Undefined or JsonValueKind.Null ? "{}" : el.GetRawText();

    private static JsonElement ParseJson(string json)
        => JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone();
}
