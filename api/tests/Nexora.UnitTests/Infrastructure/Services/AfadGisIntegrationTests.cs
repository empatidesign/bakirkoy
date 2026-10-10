using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Nexora.Application.Common.Interfaces;
using Nexora.Application.Common.Repositories;
using Nexora.Application.Configuration;
using Nexora.Application.Features.EmergencyAreas;
using Nexora.Domain.Entities.EmergencyAreas;
using Nexora.Domain.Enums;
using Nexora.Infrastructure.Services.EmergencyAreas;
using Nexora.Infrastructure.Services.Scheduled;
using System.Linq.Expressions;
using Xunit;

namespace Nexora.UnitTests.Infrastructure.Services;

public class AfadGisIntegrationTests
{
    private static readonly AfadCoordinateConverter Tm30 = new(30, 1.0);

    // Referans değerler pyproj ile üretildi: (28.87E, 41.10N) → EPSG:5254 ve EPSG:3857.
    [Theory]
    [InlineData(405070.2299921837, 4552294.1989407595)]   // ITRF96 / TM30 (Sağa, Yukarı)
    [InlineData(4552294.1989407595, 405070.2299921837)]   // eksenleri ters gelen Netcad çıktısı
    [InlineData(3213793.6992018083, 5027102.849122585)]   // Web Mercator
    [InlineData(28.87, 41.10)]                             // WGS84
    public void ToLatLng_DetectsCrs_AndConverts(double x, double y)
    {
        var ll = Tm30.ToLatLng(x, y);
        Assert.Equal(41.10, ll.Lat, 6);
        Assert.Equal(28.87, ll.Lng, 6);
    }

    [Fact]
    public void Parse_ReadsRowsAndFeatures_ComputesCentroidAndArea()
    {
        // 100m x 50m dikdörtgen, TM30 metre cinsinden
        const double e = 405000, n = 4552000;
        var json = $$"""
        {
          "type": "FeatureCollection",
          "TotalRowCount": 2,
          "PageSize": 2,
          "features": [
            { "type": "Feature", "properties": { "Mahalle": "GAZİ MAH.", "Adı": "Gazi Parkı" },
              "geometry": { "type": "Polygon", "coordinates": [[[{{e}},{{n}}],[{{e + 100}},{{n}}],[{{e + 100}},{{n + 50}}],[{{e}},{{n + 50}}],[{{e}},{{n}}]]] } },
            { "type": "Feature", "properties": { "Adı": "Nokta Alan" },
              "geometry": { "type": "Point", "coordinates": [28.87, 41.10] } }
          ],
          "rows": [
            { "Cells": [
              { "Value": 7, "DisplayText": "7", "ColumnName": "objectid", "Path": "ext_afad_3.objectid" },
              { "Value": 1250, "DisplayText": "1.250", "ColumnName": "kapasite", "Path": "ext_afad_3.kapasite" },
              { "Value": "Atatürk Cd. No:1", "ColumnName": "adres", "Path": "ext_afad_3.adres" }
            ]},
            { "Cells": [ { "Value": 8, "ColumnName": "objectid", "Path": "ext_afad_3.objectid" } ] }
          ]
        }
        """;

        var page = AfadGisGeoJsonParser.Parse(json, Tm30);

        Assert.Equal(2, page.RawCount);
        Assert.Equal(2, page.TotalRowCount);
        var a = page.Items[0];
        Assert.Equal(7, a.ObjectId);
        Assert.Equal("Gazi Parkı", a.Name);
        Assert.Equal("GAZİ MAH.", a.Neighborhood);
        Assert.Equal("Atatürk Cd. No:1", a.Address);
        Assert.Equal(1250, a.Capacity);
        Assert.InRange(a.AreaSizeM2!.Value, 4950, 5050);
        Assert.InRange(a.Latitude!.Value, 41.09, 41.11);
        Assert.InRange(a.Longitude!.Value, 28.86, 28.88);

        var b = page.Items[1];
        Assert.Equal(8, b.ObjectId);
        Assert.Equal(41.10, b.Latitude!.Value, 6);
        Assert.Null(b.AreaSizeM2);
    }

    [Fact]
    public void Parse_RealNetcadResponse_2026_10_05()
    {
        // Canlı servisten (ext_afad_3.servis) alınan yanıtın kısaltılmış hali.
        const string json = """
        {"columns":[{"DisplayName":"Ad","Path":"ext_afad_3.ad","ColumnName":"ext_afad_3.ad","DataTypeName":"String"},
                    {"DisplayName":"Poly","Path":"ext_afad_3.objectid","DataTypeName":"Geometry"}],
         "type":"FeatureCollection","bbox":[28.86,41.10,28.87,41.11],"PrimaryKey":"ext_afad_3.objectid",
         "features":[{"type":"Feature","properties":{"Poly":1,"Ad":"Şehit Polis Metahan Şahbaz Parkı","SYS::GeometryKey":1,
            "SYS::Centroid":[28.866635312574,41.1004899053199]},
            "geometry":{"type":"Polygon","coordinates":[[[28.86603997,41.10049477],[28.86715485,41.10077617],[28.86718216,41.10046951],[28.86617104,41.10021072],[28.86603997,41.10049477]]]}}],
         "rows":[{"Cells":[{"Path":"ext_afad_3.objectid","Value":1,"DisplayText":"1"},{"Path":"ext_afad_3.ad","Value":"Şehit Polis Metahan Şahbaz Parkı","DisplayText":"Şehit Polis Metahan Şahbaz Parkı"}]}]}
        """;

        var item = Assert.Single(AfadGisGeoJsonParser.Parse(json, Tm30).Items);

        Assert.Equal(1, item.ObjectId);
        Assert.Equal("Şehit Polis Metahan Şahbaz Parkı", item.Name);
        Assert.Equal(41.10049, item.Latitude!.Value, 4);   // servisin SYS::Centroid değeriyle uyumlu
        Assert.Equal(28.86664, item.Longitude!.Value, 4);
        Assert.InRange(item.AreaSizeM2!.Value, 3000, 3300); // canlı senkronda 3132 m²
    }

    [Theory]
    [InlineData("GAZİ MAH.", "Gazi Mahallesi")]
    [InlineData("gazi", "Gazi Mahallesi")]
    [InlineData("50. YIL MAHALLESİ", "50. Yıl Mahallesi")]
    [InlineData("İSMETPAŞA MH.", "İsmetpaşa Mahallesi")]
    [InlineData(null, "Belirtilmemiş")]
    public void ResolveNeighborhood_MapsToCanonical(string? raw, string expected)
        => Assert.Equal(expected, AfadGisSyncJob.ResolveNeighborhood(raw));

    [Fact]
    public async Task Sync_UpsertsByObjectId_PassivatesMissing_PreservesManualFields()
    {
        var existing = EmergencyArea.Create("Eski Ad", "Gazi Mahallesi", "Eski adres");
        existing.SetEmergencyPhone("112");
        existing.MarkSynced(AfadGisSyncJob.Source, 1, DateTime.UtcNow.AddDays(-1));
        var gone = EmergencyArea.Create("Kaldırılan", "Gazi Mahallesi", "x");
        gone.MarkSynced(AfadGisSyncJob.Source, 2, DateTime.UtcNow.AddDays(-1));

        var added = new List<EmergencyArea>();
        var repo = new Mock<IEmergencyAreaRepository>();
        repo.Setup(r => r.FindIncludingDeletedAsync(It.IsAny<Expression<Func<EmergencyArea, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([existing, gone]);
        repo.Setup(r => r.AddAsync(It.IsAny<EmergencyArea>(), It.IsAny<CancellationToken>()))
            .Callback<EmergencyArea, CancellationToken>((e, _) => added.Add(e)).Returns(Task.CompletedTask);
        var uow = new Mock<IUnitOfWork>();
        uow.SetupGet(u => u.EmergencyAreas).Returns(repo.Object);

        var client = new Mock<IAfadGisClient>();
        client.Setup(c => c.FetchAllAsync(It.IsAny<CancellationToken>())).ReturnsAsync([
            new AfadGisAreaItem(1, "Yeni Ad", "gazi", null, 41.1, 28.87, 500, 2000),
            new AfadGisAreaItem(3, null, "YAYLA MAH.", null, 41.11, 28.88, null, null),
        ]);

        var job = new AfadGisSyncJob(uow.Object, client.Object, Mock.Of<IAuditService>(),
            Mock.Of<IOptionsMonitor<AfadGisSettings>>(o => o.CurrentValue == new AfadGisSettings()),
            NullLogger<AfadGisSyncJob>.Instance);

        var result = await job.SyncAsync(CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal((2, 1, 1, 1), (result.Fetched, result.Created, result.Updated, result.Removed));
        Assert.Equal("Yeni Ad", existing.Name);
        Assert.Equal("Eski adres", existing.Address);
        Assert.Equal("112", existing.EmergencyPhone);
        Assert.Equal(500, existing.Capacity);
        Assert.Equal(EmergencyAreaStatus.Passive, gone.Status);
        var created = Assert.Single(added);
        Assert.Equal("AFAD Toplanma Alanı #3", created.Name);
        Assert.Equal("Yayla Mahallesi", created.Neighborhood);
        Assert.Equal(3, created.ExternalId);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Sync_ClientFailure_KeepsDataAndReportsError()
    {
        var uow = new Mock<IUnitOfWork>();
        var client = new Mock<IAfadGisClient>();
        client.Setup(c => c.FetchAllAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new HttpRequestException("timeout"));
        var job = new AfadGisSyncJob(uow.Object, client.Object, Mock.Of<IAuditService>(),
            Mock.Of<IOptionsMonitor<AfadGisSettings>>(o => o.CurrentValue == new AfadGisSettings()),
            NullLogger<AfadGisSyncJob>.Instance);

        var result = await job.SyncAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Equal("timeout", result.Error);
        uow.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Sync_HttpTimeout_ReturnsFailureInsteadOfThrowing()
    {
        var uow = new Mock<IUnitOfWork>();
        var client = new Mock<IAfadGisClient>();
        client.Setup(c => c.FetchAllAsync(It.IsAny<CancellationToken>())).ThrowsAsync(new TaskCanceledException());
        var job = new AfadGisSyncJob(uow.Object, client.Object, Mock.Of<IAuditService>(),
            Mock.Of<IOptionsMonitor<AfadGisSettings>>(o => o.CurrentValue == new AfadGisSettings()),
            NullLogger<AfadGisSyncJob>.Instance);

        var result = await job.SyncAsync(CancellationToken.None);

        Assert.False(result.Success);
        Assert.Contains("zaman aşımı", result.Error);
    }

    [Fact]
    public async Task Client_LogsIn_PagesUntilTotal_AndRetriesOnExpiredSession()
    {
        var calls = new List<string>();
        var queryCount = 0;
        var handler = new StubHandler(req =>
        {
            calls.Add(req.Method + " " + req.RequestUri!.PathAndQuery);
            if (req.RequestUri.AbsolutePath.EndsWith("/authentication/login"))
                return Json("""{"sessionid":"S""" + calls.Count + "\"}");
            queryCount++;
            if (queryCount == 2) return new HttpResponseMessage(System.Net.HttpStatusCode.Unauthorized);
            var start = int.Parse(System.Web.HttpUtility.ParseQueryString(req.RequestUri.Query)["startReadIndex"]!);
            var rows = Enumerable.Range(start, Math.Min(2, 3 - start))
                .Select(i => $$"""{"Cells":[{"Value":{{i + 1}},"Path":"ext_afad_3.objectid"}]}""");
            return Json($$"""{"type":"FeatureCollection","TotalRowCount":3,"features":[],"rows":[{{string.Join(',', rows)}}]}""");
        });
        var settings = new AfadGisSettings { Enabled = true, BaseUrl = "https://gis.test/BELNET/", UserName = "GUEST", Password = "GUEST", PageSize = 2 };
        var client = new AfadGisClient(new HttpClient(handler),
            Mock.Of<IOptionsMonitor<AfadGisSettings>>(o => o.CurrentValue == settings), NullLogger<AfadGisClient>.Instance);

        var items = await client.FetchAllAsync(CancellationToken.None);

        Assert.Equal([1L, 2L, 3L], items.Select(i => i.ObjectId).Order());
        Assert.Equal(2, calls.Count(c => c.Contains("/authentication/login")));
        Assert.Contains(calls, c => c.Contains("QueryName=ext_afad_3.servis") && c.Contains("startReadIndex=2") && c.Contains("pageCount=2"));
    }

    private static HttpResponseMessage Json(string body)
        => new(System.Net.HttpStatusCode.OK) { Content = new StringContent(body, System.Text.Encoding.UTF8, "application/json") };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> fn) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
            => Task.FromResult(fn(request));
    }
}
