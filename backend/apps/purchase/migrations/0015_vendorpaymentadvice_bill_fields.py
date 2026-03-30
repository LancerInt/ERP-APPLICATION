"""Add bill/payment detail fields to VendorPaymentAdvice."""

from decimal import Decimal
from django.db import migrations, models
import django.core.validators
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0014_alter_freightdetail_transporter'),
    ]

    operations = [
        # Add receipt_advice FK
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='receipt_advice',
            field=models.ForeignKey(
                blank=True,
                help_text='Linked receipt advice / GRN',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='payment_advices',
                to='purchase.receiptadvice',
            ),
        ),
        # Add invoice fields
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='invoice_no',
            field=models.CharField(blank=True, default='', help_text='Vendor bill / invoice number', max_length=100),
        ),
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='invoice_date',
            field=models.DateField(blank=True, help_text='Vendor invoice date', null=True),
        ),
        # Add deduction fields
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='tds_amount',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0.00'),
                help_text='TDS deduction amount', max_digits=18,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='other_deductions',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0.00'),
                help_text='Other deductions', max_digits=18,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        # Add paid_amount
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='paid_amount',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('0.00'),
                help_text='Amount paid so far', max_digits=18,
                validators=[django.core.validators.MinValueValidator(Decimal('0.00'))],
            ),
        ),
        # Add payment info fields
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='payment_reference',
            field=models.CharField(blank=True, default='', help_text='Payment reference / UTR number', max_length=200),
        ),
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='payment_date',
            field=models.DateField(blank=True, help_text='Date of payment', null=True),
        ),
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='bank_name',
            field=models.CharField(blank=True, default='', help_text='Bank name for payment', max_length=200),
        ),
        migrations.AddField(
            model_name='vendorpaymentadvice',
            name='transaction_id',
            field=models.CharField(blank=True, default='', help_text='Bank transaction ID', max_length=200),
        ),
        # Alter existing fields to be more flexible
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='source_document_type',
            field=models.CharField(blank=True, choices=[('PO', 'Purchase Order'), ('RECEIPT', 'Receipt/GRN'), ('FREIGHT', 'Freight'), ('WAGE', 'Loading/Unloading Wage'), ('CREDIT_NOTE', 'Credit Note')], default='', max_length=20),
        ),
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='source_document_id',
            field=models.UUIDField(blank=True, db_index=True, help_text='ID of source document (PO, Receipt, etc.)', null=True),
        ),
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='due_date',
            field=models.DateField(blank=True, db_index=True, null=True),
        ),
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='payment_method',
            field=models.CharField(blank=True, choices=[('BANK_TRANSFER', 'Bank Transfer'), ('CASH', 'Cash'), ('CHEQUE', 'Cheque'), ('UPI', 'UPI'), ('NEFT', 'NEFT'), ('RTGS', 'RTGS')], default='BANK_TRANSFER', max_length=20),
        ),
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='status',
            field=models.CharField(choices=[('DRAFT', 'Draft'), ('PENDING', 'Pending'), ('APPROVED', 'Approved'), ('PARTIALLY_PAID', 'Partially Paid'), ('PAID', 'Paid'), ('ON_HOLD', 'On Hold')], db_index=True, default='DRAFT', max_length=20),
        ),
        migrations.AlterField(
            model_name='vendorpaymentadvice',
            name='prepared_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, to='core.stakeholderuser'),
        ),
    ]
