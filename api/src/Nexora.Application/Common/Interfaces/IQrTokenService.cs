namespace Nexora.Application.Common.Interfaces;

public interface IQrTokenService
{
    string Generate(Guid subjectId, string context, int windowSeconds);
    bool Verify(string token, Guid subjectId, string context, int windowSeconds, int toleranceWindows = 1);
    bool TryParseSubjectId(string token, out Guid subjectId);
    bool TryParseContext(string token, out string context);
    bool IsRotatingToken(string token);
}
