"""
Add new permission fields (can_approve, can_reject, can_send_email, can_export, can_print)
to RolePermission model, and insert missing ERP modules.
"""

from django.db import migrations, models


def add_missing_modules(apps, schema_editor):
    """Insert modules that don't already exist."""
    ERPModule = apps.get_model('rbac', 'ERPModule')

    new_modules = [
        {'name': 'Vendor Bill', 'slug': 'vendor-bill', 'description': 'Vendor bills and invoices', 'icon': 'file-text', 'order': 19},
        {'name': 'Payment Made', 'slug': 'payment-made', 'description': 'Payments made to vendors', 'icon': 'credit-card', 'order': 20},
        {'name': 'Vendor Credit', 'slug': 'vendor-credit', 'description': 'Vendor credit notes', 'icon': 'file-minus', 'order': 20},
        {'name': 'Freight Advice (Outbound)', 'slug': 'freight-advice-outbound', 'description': 'Outbound freight management', 'icon': 'navigation', 'order': 24},
    ]

    for mod_data in new_modules:
        ERPModule.objects.get_or_create(
            slug=mod_data['slug'],
            defaults=mod_data,
        )


def set_it_admin_full_permissions(apps, schema_editor):
    """Set all 9 permission fields to True for the IT Admin role on every module."""
    ERPRole = apps.get_model('rbac', 'ERPRole')
    ERPModule = apps.get_model('rbac', 'ERPModule')
    RolePermission = apps.get_model('rbac', 'RolePermission')

    try:
        it_admin = ERPRole.objects.get(name='IT Admin')
    except ERPRole.DoesNotExist:
        return

    all_modules = ERPModule.objects.filter(is_active=True)
    for module in all_modules:
        RolePermission.objects.update_or_create(
            role=it_admin,
            module=module,
            defaults={
                'can_view': True,
                'can_create': True,
                'can_edit': True,
                'can_delete': True,
                'can_approve': True,
                'can_reject': True,
                'can_send_email': True,
                'can_export': True,
                'can_print': True,
            },
        )


class Migration(migrations.Migration):

    dependencies = [
        ('rbac', '0002_userroleassignment_rolepermission'),
    ]

    operations = [
        # Add new boolean fields to RolePermission
        migrations.AddField(
            model_name='rolepermission',
            name='can_approve',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='rolepermission',
            name='can_reject',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='rolepermission',
            name='can_send_email',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='rolepermission',
            name='can_export',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='rolepermission',
            name='can_print',
            field=models.BooleanField(default=False),
        ),
        # Insert missing modules
        migrations.RunPython(add_missing_modules, migrations.RunPython.noop),
        # Update IT Admin role with full permissions
        migrations.RunPython(set_it_admin_full_permissions, migrations.RunPython.noop),
    ]
