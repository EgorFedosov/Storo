using System.Globalization;
using backend.Modules.Users.UseCases.AdminModeration;

namespace backend.Modules.Users.Api;

public sealed record AdminModerationResponse(
    string UserId,
    string Status,
    bool Changed)
{
    public static AdminModerationResponse FromResult(AdminModerationResult result)
    {
        ArgumentNullException.ThrowIfNull(result);

        return new AdminModerationResponse(
            result.UserId.ToString(CultureInfo.InvariantCulture),
            ToContractStatus(result.Status),
            result.Changed);
    }

    private static string ToContractStatus(AdminModerationOperationStatus status) => status switch
    {
        AdminModerationOperationStatus.Blocked => "blocked",
        AdminModerationOperationStatus.Unblocked => "unblocked",
        AdminModerationOperationStatus.AdminGranted => "admin_granted",
        AdminModerationOperationStatus.AdminRevoked => "admin_revoked",
        _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unsupported moderation status.")
    };
}
