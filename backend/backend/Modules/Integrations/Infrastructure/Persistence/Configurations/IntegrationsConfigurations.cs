using backend.Modules.Integrations.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace backend.Modules.Integrations.Infrastructure.Persistence.Configurations;

public sealed class SupportTicketExportConfiguration : IEntityTypeConfiguration<SupportTicketExport>
{
    public void Configure(EntityTypeBuilder<SupportTicketExport> entity)
    {
        entity.ToTable("support_ticket_exports");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        entity.Property(x => x.TicketId)
            .HasColumnName("ticket_id")
            .HasMaxLength(128)
            .IsRequired();

        entity.Property(x => x.ReportedByUserId)
            .HasColumnName("reported_by_user_id")
            .IsRequired();

        entity.Property(x => x.InventoryId)
            .HasColumnName("inventory_id");

        entity.Property(x => x.Summary)
            .HasColumnName("summary")
            .HasMaxLength(4000)
            .IsRequired();

        entity.Property(x => x.Priority)
            .HasColumnName("priority")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.PageLink)
            .HasColumnName("page_link")
            .HasMaxLength(2048)
            .IsRequired();

        entity.Property(x => x.Provider)
            .HasColumnName("provider")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.AdminsEmailsSnapshot)
            .HasColumnName("admins_emails_snapshot")
            .IsRequired();

        entity.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.UploadedFileRef)
            .HasColumnName("uploaded_file_ref")
            .HasMaxLength(2048);

        entity.Property(x => x.ProviderFileId)
            .HasColumnName("provider_file_id")
            .HasMaxLength(512);

        entity.Property(x => x.ProviderRev)
            .HasColumnName("provider_rev")
            .HasMaxLength(512);

        entity.Property(x => x.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(4000);

        entity.Property(x => x.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        entity.Property(x => x.UploadedAtUtc)
            .HasColumnName("uploaded_at_utc");

        entity.HasOne(x => x.ReportedByUser)
            .WithMany()
            .HasForeignKey(x => x.ReportedByUserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasOne(x => x.Inventory)
            .WithMany()
            .HasForeignKey(x => x.InventoryId)
            .OnDelete(DeleteBehavior.SetNull);

        entity.HasIndex(x => x.TicketId)
            .IsUnique();

        entity.HasIndex(x => x.ReportedByUserId);
        entity.HasIndex(x => x.InventoryId);
        entity.HasIndex(x => x.CreatedAtUtc);
    }
}

public sealed class SalesforceContactConfiguration : IEntityTypeConfiguration<SalesforceContact>
{
    public void Configure(EntityTypeBuilder<SalesforceContact> entity)
    {
        entity.ToTable("salesforce_contacts");
        entity.HasKey(x => x.Id);

        entity.Property(x => x.Id)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        entity.Property(x => x.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        entity.Property(x => x.SfAccountId)
            .HasColumnName("sf_account_id")
            .HasMaxLength(128);

        entity.Property(x => x.SfContactId)
            .HasColumnName("sf_contact_id")
            .HasMaxLength(128);

        entity.Property(x => x.SyncStatus)
            .HasColumnName("sync_status")
            .HasMaxLength(32)
            .IsRequired();

        entity.Property(x => x.LastSyncAtUtc)
            .HasColumnName("last_sync_at_utc");

        entity.Property(x => x.LastError)
            .HasColumnName("last_error")
            .HasMaxLength(4000);

        entity.Property(x => x.CreatedAtUtc)
            .HasColumnName("created_at_utc")
            .IsRequired();

        entity.Property(x => x.UpdatedAtUtc)
            .HasColumnName("updated_at_utc")
            .IsRequired();

        entity.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        entity.HasIndex(x => x.UserId)
            .IsUnique();

        entity.HasIndex(x => x.SfAccountId);
        entity.HasIndex(x => x.SfContactId);
    }
}
