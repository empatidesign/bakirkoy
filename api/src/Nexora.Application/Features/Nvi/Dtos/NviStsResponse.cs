namespace Nexora.Application.Features.Nvi.Dtos;

public record NviStsResponse(
    byte[] BinarySecret,
    string KeyIdentifier,
    string X509IssuerName,
    string X509SerialNumber,
    string EncryptedKeyCipherValue,
    string EncryptedDataCipherValue,
    DateTime ExpiresAt);
