import re
import string
import random
from datetime import datetime, timedelta
from decimal import Decimal
from django.db.models import Max
from django.utils.text import slugify


def generate_document_number(model_class, prefix, year=None):
    """
    Generate a unique document number based on format: {prefix}-{year}-{counter:05d}

    Args:
        model_class: The model class to check existing numbers
        prefix: Document prefix (e.g., 'PO', 'SO')
        year: Year to use (default: current year)

    Returns:
        str: Formatted document number
    """
    if year is None:
        year = datetime.now().year

    # Find the highest counter for this prefix and year
    document_code_prefix = f"{prefix}-{year}-"

    max_counter = model_class.objects.filter(
        document_number__startswith=document_code_prefix,
        created_at__year=year
    ).values('document_number').aggregate(
        max_counter=Max('document_number')
    )['max_counter']

    if max_counter:
        # Extract counter from existing document number
        counter = int(max_counter.split('-')[-1]) + 1
    else:
        counter = 1

    return f"{document_code_prefix}{counter:05d}"


def calculate_gst(amount, tax_rate):
    """
    Calculate GST (Goods and Services Tax).

    Args:
        amount: Base amount
        tax_rate: Tax rate percentage (e.g., 18 for 18%)

    Returns:
        tuple: (base_amount, tax_amount, total_amount)
    """
    amount = Decimal(str(amount))
    tax_rate = Decimal(str(tax_rate))

    tax_amount = amount * (tax_rate / Decimal(100))
    total_amount = amount + tax_amount

    return (amount, tax_amount.quantize(Decimal('0.01')), total_amount.quantize(Decimal('0.01')))


def slugify_code(text):
    """
    Create a slug-like code from text.

    Args:
        text: Input text

    Returns:
        str: Slugified code
    """
    return slugify(text).replace('-', '_').upper()


def generate_random_code(length=8, prefix=''):
    """
    Generate a random alphanumeric code.

    Args:
        length: Length of random part
        prefix: Optional prefix

    Returns:
        str: Generated code
    """
    chars = string.ascii_uppercase + string.digits
    random_part = ''.join(random.choices(chars, k=length))
    return f"{prefix}{random_part}" if prefix else random_part


def round_to_nearest(value, nearest):
    """
    Round value to nearest specified amount.

    Args:
        value: Value to round
        nearest: Round to this value

    Returns:
        Decimal: Rounded value
    """
    value = Decimal(str(value))
    nearest = Decimal(str(nearest))
    return (value / nearest).quantize(0) * nearest


def calculate_discount(amount, discount_type, discount_value):
    """
    Calculate discount amount.

    Args:
        amount: Base amount
        discount_type: 'percentage' or 'fixed'
        discount_value: Discount value

    Returns:
        Decimal: Discount amount
    """
    amount = Decimal(str(amount))
    discount_value = Decimal(str(discount_value))

    if discount_type == 'percentage':
        return (amount * discount_value / Decimal(100)).quantize(Decimal('0.01'))
    else:
        return discount_value.quantize(Decimal('0.01'))


def calculate_age_in_days(from_date, to_date=None):
    """
    Calculate days between two dates.

    Args:
        from_date: Start date
        to_date: End date (default: today)

    Returns:
        int: Number of days
    """
    if to_date is None:
        to_date = datetime.now().date() if hasattr(datetime.now(), 'date') else datetime.now()

    if hasattr(from_date, 'date'):
        from_date = from_date.date()
    if hasattr(to_date, 'date'):
        to_date = to_date.date()

    delta = to_date - from_date
    return delta.days


def parse_decimal(value, default=Decimal('0.00')):
    """
    Safely parse value to Decimal.

    Args:
        value: Value to parse
        default: Default value if parsing fails

    Returns:
        Decimal: Parsed decimal value
    """
    try:
        return Decimal(str(value)).quantize(Decimal('0.01'))
    except (ValueError, TypeError):
        return default


def validate_email(email):
    """
    Validate email format.

    Args:
        email: Email address

    Returns:
        bool: True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone):
    """
    Validate phone number (basic).

    Args:
        phone: Phone number

    Returns:
        bool: True if valid, False otherwise
    """
    # Remove common separators
    cleaned = re.sub(r'[\s\-\(\)\.]+', '', str(phone))
    # Check if it has 10-15 digits
    return bool(re.match(r'^\+?1?\d{9,14}$', cleaned))


def mask_sensitive_data(data, mask_pattern='****'):
    """
    Mask sensitive data for logging.

    Args:
        data: Data to mask
        mask_pattern: Pattern to use for masking

    Returns:
        str: Masked data
    """
    if not data:
        return mask_pattern

    data_str = str(data)
    if len(data_str) <= 4:
        return mask_pattern

    return data_str[:2] + mask_pattern + data_str[-2:]


def get_financial_year(date=None):
    """
    Get financial year (April-March) for given date.

    Args:
        date: Date (default: today)

    Returns:
        tuple: (start_date, end_date)
    """
    if date is None:
        date = datetime.now().date() if hasattr(datetime.now(), 'date') else datetime.now()

    if hasattr(date, 'date'):
        date = date.date()

    year = date.year
    if date.month >= 4:
        start = datetime(year, 4, 1).date()
        end = datetime(year + 1, 3, 31).date()
    else:
        start = datetime(year - 1, 4, 1).date()
        end = datetime(year, 3, 31).date()

    return (start, end)


def chunk_list(lst, chunk_size):
    """
    Split list into chunks.

    Args:
        lst: List to chunk
        chunk_size: Size of each chunk

    Yields:
        list: Chunk of specified size
    """
    for i in range(0, len(lst), chunk_size):
        yield lst[i:i + chunk_size]
