using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.DataProtection.AuthenticatedEncryption.ConfigurationModel;
using Microsoft.AspNetCore.DataProtection.Repositories;

namespace Dailo.Infrastructure.DataProtection;

/// <summary>
/// An <see cref="IXmlRepository"/> that derives a deterministic Data Protection key
/// from a secret held in configuration. Nothing is persisted — the same secret always
/// produces the same key ring, so no database or filesystem storage is needed.
/// </summary>
internal sealed class SecretKeyXmlRepository : IXmlRepository
{
    // AES_256_CBC needs 32 bytes + HMACSHA256 needs 32 bytes = 64 bytes master key.
    private const int MasterKeySizeInBytes = 64;

    private readonly IReadOnlyCollection<XElement> _elements;

    internal SecretKeyXmlRepository(string key)
    {
        var secret = Encoding.UTF8.GetBytes(key);

        var masterKey = HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            ikm: secret,
            outputLength: MasterKeySizeInBytes,
            info: "DataProtection.MasterKey"u8.ToArray()
        );

        var keyIdBytes = HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            ikm: secret,
            outputLength: 16,
            info: "DataProtection.KeyId"u8.ToArray()
        );

        _elements = [BuildKeyElement(new Guid(keyIdBytes), masterKey)];
    }

    public IReadOnlyCollection<XElement> GetAllElements() => _elements;

    // No-op: the key is derived from config, not stored anywhere.
    public void StoreElement(XElement element, string friendlyName) { }

    private static XElement BuildKeyElement(Guid keyId, byte[] masterKey) =>
        new("key",
            new XAttribute("id", keyId.ToString()),
            new XAttribute("version", "1"),
            new XElement("creationDate", "2000-01-01T00:00:00Z"),
            new XElement("activationDate", "2000-01-01T00:00:00Z"),
            new XElement("expirationDate", "2099-12-31T23:59:59Z"),
            new XElement("descriptor",
                new XAttribute("deserializerType", typeof(AuthenticatedEncryptorDescriptorDeserializer).AssemblyQualifiedName!),
                new XElement("descriptor",
                    new XElement("encryption", new XAttribute("algorithm", "AES_256_CBC")),
                    new XElement("validation", new XAttribute("algorithm", "HMACSHA256")),
                    new XElement("masterKey",
                        new XElement("value", Convert.ToBase64String(masterKey))
                    )
                )
            )
        );
}
