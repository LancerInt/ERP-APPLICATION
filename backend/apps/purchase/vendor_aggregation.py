"""
Vendor aggregation service for RFQ email routing.
Collects preferred vendors from products linked to an RFQ's purchase requests
and merges them with manually selected vendors.
"""


def get_rfq_auto_vendors(rfq):
    """
    Get all preferred vendors from all products in the RFQ's linked PRs.

    Args:
        rfq: RFQHeader instance

    Returns:
        QuerySet of active Vendor instances
    """
    from master.models import Vendor

    vendor_ids = set()

    # Get products from linked PRs (ManyToMany: rfq.linked_prs)
    for pr in rfq.linked_prs.all():
        for line in pr.lines.all():
            if line.product_service:
                for vendor in line.product_service.preferred_vendors.all():
                    vendor_ids.add(vendor.id)

    # Also check RFQ's quote responses for vendors already quoted
    for quote in rfq.quote_responses.all():
        if quote.vendor_id:
            vendor_ids.add(quote.vendor_id)

    return Vendor.objects.filter(id__in=vendor_ids, is_active=True)


def get_final_vendor_list(rfq, manual_vendor_ids=None):
    """
    Merge auto vendors (from product preferences) + manual vendors, remove duplicates.

    Args:
        rfq: RFQHeader instance
        manual_vendor_ids: optional list/set of vendor UUIDs to include manually

    Returns:
        list of dicts with vendor info and source tag
    """
    from master.models import Vendor

    auto_vendors = get_rfq_auto_vendors(rfq)
    auto_ids = set(auto_vendors.values_list('id', flat=True))

    manual_ids = set()
    if manual_vendor_ids:
        manual_ids = set(manual_vendor_ids)

    all_ids = auto_ids | manual_ids

    vendors = Vendor.objects.filter(id__in=all_ids, is_active=True)

    # Split into auto and manual for UI display
    result = []
    for v in vendors:
        result.append({
            'id': str(v.id),
            'vendor_name': v.vendor_name,
            'vendor_code': v.vendor_code,
            'contact_email': v.contact_email or '',
            'source': 'auto' if v.id in auto_ids else 'manual',
            'has_email': bool(v.contact_email),
        })

    return result


def validate_vendor_emails(vendor_list):
    """
    Check all vendors have valid emails.

    Args:
        vendor_list: list of vendor dicts (from get_final_vendor_list)

    Returns:
        tuple of (valid_vendors, error_messages)
    """
    errors = []
    valid = []
    for v in vendor_list:
        if not v.get('contact_email'):
            errors.append(f"{v['vendor_name']} has no email address")
        else:
            valid.append(v)
    return valid, errors
