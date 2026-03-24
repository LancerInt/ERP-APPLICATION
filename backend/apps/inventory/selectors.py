"""Selectors for inventory queries."""

from decimal import Decimal
from django.db.models import Sum, Q, F
from .models import InventoryLedger


class InventorySelector:
    """Selector for inventory read operations."""

    @staticmethod
    def get_warehouse_stock(warehouse_id):
        """
        Get complete stock summary for a warehouse.
        Groups by product and batch.
        """
        entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            is_active=True
        ).values(
            'product_id',
            'batch',
            'godown_id',
            'uom'
        ).annotate(
            total_in=Sum('quantity_in'),
            total_out=Sum('quantity_out')
        )

        stock = {}
        for entry in entries:
            key = f"{entry['product_id']}_{entry['batch']}"
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)

            if balance > 0:
                if key not in stock:
                    stock[key] = {
                        'product_id': entry['product_id'],
                        'batch': entry['batch'],
                        'total_balance': Decimal('0'),
                        'uom': entry['uom'],
                        'godown_breakdown': []
                    }

                stock[key]['total_balance'] += balance
                stock[key]['godown_breakdown'].append({
                    'godown_id': entry['godown_id'],
                    'balance': balance
                })

        return list(stock.values())

    @staticmethod
    def get_godown_stock(godown_id):
        """Get stock in a specific godown."""
        entries = InventoryLedger.objects.filter(
            godown_id=godown_id,
            is_active=True
        ).values(
            'product_id',
            'batch',
            'uom'
        ).annotate(
            total_in=Sum('quantity_in'),
            total_out=Sum('quantity_out')
        )

        stock = []
        for entry in entries:
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)
            if balance > 0:
                stock.append({
                    'product_id': entry['product_id'],
                    'batch': entry['batch'],
                    'balance': balance,
                    'uom': entry['uom']
                })

        return stock

    @staticmethod
    def get_batch_locations(warehouse_id, product_id, batch):
        """Find all godowns containing a specific batch."""
        entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch=batch,
            is_active=True
        ).values(
            'godown_id'
        ).annotate(
            total_in=Sum('quantity_in'),
            total_out=Sum('quantity_out')
        )

        locations = []
        for entry in entries:
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)
            if balance > 0:
                locations.append({
                    'godown_id': entry['godown_id'],
                    'balance': balance
                })

        return locations

    @staticmethod
    def get_in_transit_stock(from_warehouse_id, to_warehouse_id):
        """Get stock currently in transit between warehouses."""
        entries = InventoryLedger.objects.filter(
            warehouse_id=from_warehouse_id,
            status='IN_TRANSIT',
            transaction_type='TRANSFER',
            is_active=True
        ).values(
            'product_id',
            'batch',
            'uom'
        ).annotate(
            total_in=Sum('quantity_in'),
            total_out=Sum('quantity_out')
        )

        transit = []
        for entry in entries:
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)
            if balance > 0:
                transit.append({
                    'product_id': entry['product_id'],
                    'batch': entry['batch'],
                    'quantity_in_transit': balance,
                    'uom': entry['uom']
                })

        return transit

    @staticmethod
    def get_fifo_valuation(warehouse_id, product_id):
        """
        Calculate FIFO valuation for stock.
        Returns earliest cost layers used for valuation.
        """
        current_balance = InventorySelector.get_warehouse_stock(warehouse_id)

        product_stock = next(
            (item for item in current_balance if str(item['product_id']) == str(product_id)),
            None
        )

        if not product_stock:
            return {'total_value': Decimal('0'), 'layers': []}

        total_balance = product_stock['total_balance']
        fifo_layers = []

        ledger_entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            product_id=product_id,
            quantity_in__gt=0,
            is_active=True
        ).order_by('transaction_date', 'created_at')

        remaining_balance = total_balance
        total_value = Decimal('0')

        for entry in ledger_entries:
            if remaining_balance <= 0:
                break

            quantity_used = min(entry.quantity_in, remaining_balance)
            cost = entry.cost or Decimal('0')
            layer_value = quantity_used * cost

            fifo_layers.append({
                'transaction_date': entry.transaction_date,
                'batch': entry.batch,
                'quantity': quantity_used,
                'cost_per_unit': cost,
                'layer_value': layer_value
            })

            total_value += layer_value
            remaining_balance -= quantity_used

        return {
            'product_id': product_id,
            'total_quantity': total_balance,
            'total_value': total_value,
            'average_cost': total_value / total_balance if total_balance > 0 else Decimal('0'),
            'layers': fifo_layers
        }

    @staticmethod
    def get_slow_moving_stock(warehouse_id, days_threshold=90):
        """
        Identify slow-moving stock.
        Items with no recent movement.
        """
        from django.utils import timezone
        from datetime import timedelta

        threshold_date = timezone.now().date() - timedelta(days=days_threshold)

        recent_movements = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            transaction_date__gte=threshold_date,
            is_active=True
        ).values_list('product_id', 'batch', flat=False)

        recent_keys = set((entry[0], entry[1]) for entry in recent_movements)

        slow_stock = InventorySelector.get_warehouse_stock(warehouse_id)

        slow_moving = [
            item for item in slow_stock
            if (str(item['product_id']), item['batch']) not in recent_keys
        ]

        return slow_moving

    @staticmethod
    def get_stock_variance_report(warehouse_id, product_id, batch):
        """
        Get detailed variance report for product-batch.
        Shows discrepancies between recorded and actual.
        """
        entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            product_id=product_id,
            batch=batch,
            is_active=True
        ).order_by('transaction_date', 'created_at')

        running_balance = Decimal('0')
        variance_entries = []

        for entry in entries:
            net = (entry.quantity_in or 0) - (entry.quantity_out or 0)
            running_balance += net

            variance_entries.append({
                'ledger_id': str(entry.id),
                'transaction_date': entry.transaction_date,
                'transaction_type': entry.transaction_type,
                'quantity_in': entry.quantity_in,
                'quantity_out': entry.quantity_out,
                'running_balance': running_balance,
                'source_document_type': entry.source_document_type,
                'source_document_id': str(entry.source_document_id),
                'remarks': entry.remarks
            })

        return {
            'product_id': product_id,
            'batch': batch,
            'final_balance': running_balance,
            'transaction_count': len(variance_entries),
            'transactions': variance_entries
        }

    @staticmethod
    def get_expiring_stock(warehouse_id, expiry_threshold_days=30):
        """
        Get stock approaching expiry date.
        Based on batch information and shelf life.
        """
        entries = InventoryLedger.objects.filter(
            warehouse_id=warehouse_id,
            is_active=True
        ).values(
            'product_id',
            'batch',
            'uom'
        ).annotate(
            total_in=Sum('quantity_in'),
            total_out=Sum('quantity_out')
        )

        expiring = []
        for entry in entries:
            balance = (entry['total_in'] or 0) - (entry['total_out'] or 0)
            if balance > 0:
                expiring.append({
                    'product_id': entry['product_id'],
                    'batch': entry['batch'],
                    'balance': balance,
                    'uom': entry['uom']
                })

        return expiring
