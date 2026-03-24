"""
Initial migration for the communications app.
Creates EmailTemplate and EmailLog models.
"""
import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('purchase', '0001_initial'),
        ('master', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailTemplate',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, help_text='Unique identifier', primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Creation timestamp')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='Last modification timestamp')),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Soft delete flag')),
                ('name', models.CharField(max_length=200, unique=True)),
                ('subject', models.CharField(help_text='Email subject. Supports {{placeholders}}', max_length=500)),
                ('body_html', models.TextField(help_text='Email body in HTML. Supports {{placeholders}}')),
                ('pdf_header_html', models.TextField(blank=True, default='', help_text='PDF header section HTML')),
                ('pdf_body_html', models.TextField(help_text='PDF body template HTML. Supports {{placeholders}} and {{product_table}}')),
                ('pdf_footer_html', models.TextField(blank=True, default='', help_text='PDF footer section HTML')),
                ('is_default', models.BooleanField(default=False)),
                ('created_by', models.ForeignKey(blank=True, help_text='User who created this record', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, help_text='User who last updated this record', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'comm_email_template',
                'ordering': ['-is_default', 'name'],
            },
        ),
        migrations.CreateModel(
            name='EmailLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, help_text='Unique identifier', primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, help_text='Creation timestamp')),
                ('updated_at', models.DateTimeField(auto_now=True, help_text='Last modification timestamp')),
                ('is_active', models.BooleanField(db_index=True, default=True, help_text='Soft delete flag')),
                ('vendor_email', models.EmailField(max_length=254)),
                ('subject', models.CharField(max_length=500)),
                ('body_preview', models.TextField(blank=True)),
                ('pdf_generated', models.BooleanField(default=False)),
                ('email_sent', models.BooleanField(default=False)),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_by', models.ForeignKey(blank=True, help_text='User who created this record', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_created_by', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, help_text='User who last updated this record', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='%(class)s_updated_by', to=settings.AUTH_USER_MODEL)),
                ('rfq', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='email_logs', to='purchase.rfqheader')),
                ('template', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='email_logs', to='communications.emailtemplate')),
                ('vendor', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='email_logs', to='master.vendor')),
                ('sent_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sent_emails', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'comm_email_log',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='emailtemplate',
            index=models.Index(fields=['is_active', '-created_at'], name='comm_email__is_acti_tmpl_idx'),
        ),
        migrations.AddIndex(
            model_name='emaillog',
            index=models.Index(fields=['is_active', '-created_at'], name='comm_email__is_acti_log_idx'),
        ),
    ]
