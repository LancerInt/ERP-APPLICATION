# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('master', '0003_alter_customer_gstin_alter_transporter_gstin_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='preferred_vendors',
            field=models.ManyToManyField(
                blank=True,
                help_text='Preferred vendors for this product',
                related_name='preferred_for_products',
                to='master.vendor',
            ),
        ),
    ]
