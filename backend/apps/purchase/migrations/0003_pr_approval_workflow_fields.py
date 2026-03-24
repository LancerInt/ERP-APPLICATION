# Generated manually for PR approval workflow

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('purchase', '0002_alter_comparisonentry_freight_terms_and_more'),
    ]

    operations = [
        # Update approval_status choices to include EDITED and PENDING_APPROVAL
        migrations.AlterField(
            model_name='purchaserequest',
            name='approval_status',
            field=models.CharField(
                choices=[
                    ('DRAFT', 'Draft'),
                    ('EDITED', 'Edited'),
                    ('PENDING', 'Pending Approval'),
                    ('PENDING_APPROVAL', 'Pending Approval Review'),
                    ('APPROVED', 'Approved'),
                    ('REJECTED', 'Rejected'),
                    ('PARTIALLY_APPROVED', 'Partially Approved'),
                ],
                db_index=True,
                default='DRAFT',
                max_length=30,
            ),
        ),
        # Add approved_by field
        migrations.AddField(
            model_name='purchaserequest',
            name='approved_by',
            field=models.ForeignKey(
                blank=True,
                help_text='User who approved this PR',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='approved_purchase_requests',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # Add approved_at field
        migrations.AddField(
            model_name='purchaserequest',
            name='approved_at',
            field=models.DateTimeField(
                blank=True,
                help_text='Timestamp when the PR was approved',
                null=True,
            ),
        ),
        # Add linked_rfq field
        migrations.AddField(
            model_name='purchaserequest',
            name='linked_rfq',
            field=models.ForeignKey(
                blank=True,
                help_text='RFQ auto-created upon approval',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='source_purchase_requests',
                to='purchase.rfqheader',
            ),
        ),
    ]
