using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Nexora.Application.Common.ApiResponse;

namespace Nexora.Api.Common.Middleware;

public class ResponseWrappingMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var statusCode = context.Response.StatusCode;
            if ((statusCode == 401 || statusCode == 403) &&
                context.Response.ContentLength is null or 0 &&
                string.IsNullOrEmpty(context.Response.ContentType))
            {
                var correlationId = context.Items["CorrelationId"]?.ToString();
                var (message, errorCode) = statusCode == 401
                    ? ("Kimlik doğrulama gerekli. Lütfen giriş yapın.", "UNAUTHORIZED")
                    : ("Bu işlem için yetkiniz bulunmuyor.", "FORBIDDEN");

                var response = ApiResponse.Fail(statusCode, message, errorCode, correlationId);
                var json = JsonSerializer.Serialize(response, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
                var bytes = Encoding.UTF8.GetBytes(json);

                context.Response.ContentType = "application/json";
                context.Response.ContentLength = bytes.Length;
                return context.Response.Body.WriteAsync(bytes, 0, bytes.Length);
            }

            return Task.CompletedTask;
        });

        var originalBody = context.Response.Body;
        await using var wrapper = new ConditionalBufferStream(originalBody, context.Response);
        context.Response.Body = wrapper;

        try
        {
            await next(context);
        }
        finally
        {
            context.Response.Body = originalBody;
        }

        var buffer = wrapper.BufferedContent;
        if (buffer is null)
            return;

        buffer.Seek(0, SeekOrigin.Begin);
        var rewritten = TryInjectCorrelationId(buffer, context.Items["CorrelationId"]?.ToString()
            ?? context.Response.Headers["X-Correlation-Id"].ToString());
        if (rewritten is not null)
        {
            context.Response.ContentLength = rewritten.Length;
            await originalBody.WriteAsync(rewritten);
            return;
        }

        buffer.Seek(0, SeekOrigin.Begin);
        await buffer.CopyToAsync(originalBody);
    }

    private sealed class ConditionalBufferStream(Stream target, HttpResponse response) : Stream
    {
        private MemoryStream? _buffer;
        private bool _decided;
        private bool _passthrough;

        public MemoryStream? BufferedContent => _buffer;

        private Stream Resolve()
        {
            if (!_decided)
            {
                _decided = true;
                var contentType = response.ContentType;
                _passthrough = response.StatusCode is < 200 or >= 300
                    || string.IsNullOrEmpty(contentType)
                    || !contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase);
                if (!_passthrough) _buffer = new MemoryStream();
            }
            return _passthrough ? target : _buffer!;
        }

        public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken ct = default)
            => Resolve().WriteAsync(buffer, ct);

        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken ct)
            => Resolve().WriteAsync(buffer.AsMemory(offset, count), ct).AsTask();

        public override void Write(byte[] buffer, int offset, int count)
            => Resolve().Write(buffer, offset, count);

        public override Task FlushAsync(CancellationToken ct) => Resolve().FlushAsync(ct);
        public override void Flush() => Resolve().Flush();

        public override bool CanWrite => true;
        public override bool CanRead => false;
        public override bool CanSeek => false;
        public override long Length => throw new NotSupportedException();
        public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
    }

    private static byte[]? TryInjectCorrelationId(MemoryStream buffer, string? correlationId)
    {
        if (string.IsNullOrEmpty(correlationId)) return null;

        try
        {
            var node = JsonNode.Parse(buffer);
            if (node is not JsonObject obj) return null;

            if (!obj.ContainsKey("success") || !obj.ContainsKey("statusCode")) return null;

            var existing = obj["correlationId"];
            if (existing is not null && existing.GetValueKind() != JsonValueKind.Null) return null;

            obj["correlationId"] = correlationId;
            return Encoding.UTF8.GetBytes(obj.ToJsonString());
        }
        catch (JsonException)
        {
            return null;
        }
    }
}
