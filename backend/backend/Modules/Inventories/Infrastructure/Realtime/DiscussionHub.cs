using System.Globalization;
using Microsoft.AspNetCore.SignalR;

namespace backend.Modules.Inventories.Infrastructure.Realtime;

public sealed class DiscussionHub : Hub
{
    public static string GroupName(long inventoryId)
    {
        return $"inventory:{inventoryId.ToString(CultureInfo.InvariantCulture)}";
    }

    public async Task JoinInventoryDiscussion(string inventoryId)
    {
        var parsedInventoryId = ParseInventoryId(inventoryId, nameof(inventoryId));
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(parsedInventoryId));
    }

    public async Task LeaveInventoryDiscussion(string inventoryId)
    {
        var parsedInventoryId = ParseInventoryId(inventoryId, nameof(inventoryId));
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(parsedInventoryId));
    }

    private static long ParseInventoryId(string rawInventoryId, string argumentName)
    {
        if (!long.TryParse(rawInventoryId, NumberStyles.None, CultureInfo.InvariantCulture, out var inventoryId)
            || inventoryId <= 0)
        {
            throw new HubException($"{argumentName} must be a positive integer.");
        }

        return inventoryId;
    }
}
