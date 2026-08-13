# Minibar Management System - Complete Documentation

## Overview
The minibar management system has been completely redesigned to integrate with the main stock management system. This provides professional-grade inventory tracking, automatic stock movements, and real-time low-stock alerts.

## Architecture

### Stock Flow
```
Main Stock (Restaurant/Bar) → Hotel Stock Location → Room Minibar → Guest Consumption
```

### Database Structure

#### Key Tables
- **`stock_locations`**: Physical storage locations (Restaurant, Bar & Lounge, Casino, **Hotel**)
- **`stocks`**: Centralized inventory tracking by product and location
- **`stock_movements`**: Complete audit trail of all stock movements
- **`room_minibar`**: Per-room minibar inventory
- **`minibar_consumptions`**: Guest consumption records with billing status

#### Stock Location IDs
- `2`: Restaurant
- `3`: Bar & Lounge  
- `4`: Casino
- `5`: **Hotel** (newly added for minibar management)

## API Endpoints

### Stock Management
- `POST /api/hebergement/minibar/transfer-stock` - Transfer stock from source to hotel
- `POST /api/hebergement/minibar/restock` - Restock room minibar from hotel stock
- `GET /api/hebergement/minibar/alerts` - Get all minibar items with alert status
- `GET /api/hebergement/minibar/low-stock` - Get only low-stock items for notifications

### Consumption
- `POST /api/hebergement/minibar/consume` - Record consumption with stock deduction
- `GET /api/hebergement/minibar-consumptions?room_id=X` - Get room consumptions
- `PUT /api/hebergement/minibar-consumptions/:id` - Mark as billed

### Stock Service
- `GET /api/stock/locations` - Get all stock locations
- `GET /api/stock?location_id=X` - Get stock by location
- `GET /api/stock/product/:id` - Get stock by product
- `POST /api/stock/movements` - Record stock movement
- `GET /api/stock/movements` - Get movement history

## Business Logic

### 1. Stock Transfer Process
When transferring stock from Restaurant/Bar to Hotel:
1. Validates source stock availability
2. Deducts from source location (Restaurant/Bar)
3. Adds to Hotel location (location_id = 5)
4. Records both SOURCE and DESTINATION stock movements
5. Provides transaction rollback on failure

### 2. Minibar Restocking
When restocking a room minibar:
1. Validates Hotel stock availability
2. Deducts from Hotel stock location
3. Adds to room minibar inventory
4. Records stock movement with reference to room
5. Creates new room_minibar entry if doesn't exist

### 3. Guest Consumption
When a guest consumes minibar items:
1. Validates room minibar stock availability
2. Deducts from room minibar
3. Deducts from Hotel stock location
4. Creates consumption record with pricing
5. Records stock movement for audit trail
6. Links consumption to stock movement for reconciliation

### 4. Low Stock Alerts
- Automatic periodic checks (every 5 minutes)
- Compares current quantity vs. `seuil_alerte` threshold
- Generates notifications for items below threshold
- Prioritizes alerts by severity (out of stock > low stock)

## Frontend Components

### HotelMinibarManager
Main component for minibar management with:
- Room selection with item counts
- Stock transfer button (from Restaurant/Bar)
- Manual product addition
- Real-time inventory display
- Consumption recording
- Low stock visual indicators
- Consumption history with billing status

### StockTransferModal
Professional stock transfer interface:
- Source location selection (Restaurant/Bar)
- Product selection with available stock
- Quantity validation
- Transfer summary
- Error handling and validation

### ConsumptionModal
Guest consumption recording:
- Product selection from minibar inventory
- Stock availability validation
- Automatic price calculation
- Quantity management
- Total amount display

## Stock Movement Types

### Movement Types
- **`ENTREE`**: Stock entering a location
- **`SORTIE`**: Stock leaving a location  
- **`AJUSTEMENT`**: Manual stock adjustments

### Source Modules
- **`MINIBAR`**: Minibar stock transfers
- **`MINIBAR_CONSUMPTION`**: Guest consumptions
- **`MINIBAR_RESTOCK`**: Room minibar restocking
- **`ACHAT`**: Supplier purchases

## Notification System

### Low Stock Alerts
- Automatic detection when quantity <= seuil_alerte
- Format: "Stock faible: [Product Name] (Chambre [Room Number]) - [Quantity] unités"
- Immediate alerts for out-of-stock items
- Background checking every 5 minutes

### Alert Levels
1. **Critical**: Quantity = 0 (out of stock)
2. **Warning**: Quantity <= seuil_alerte (low stock)
3. **Normal**: Quantity > seuil_alerte

## Usage Examples

### Transfer Stock to Hotel
```javascript
await minibarService.transferStock({
  product_id: 15,
  source_location_id: 2, // Restaurant
  quantity: 10,
  room_id: 101
});
```

### Restock Room Minibar
```javascript
await minibarService.restock({
  room_id: 101,
  product_id: 15,
  quantity: 5
});
```

### Record Consumption
```javascript
await consumptionService.create({
  room_id: 101,
  client_id: 45,
  product_id: 15,
  quantite: 2,
  prix_unitaire: 5.00
});
```

### Get Low Stock Alerts
```javascript
const lowStockItems = await minibarService.getLowStockItems();
```

## Data Validation

### Business Rules
1. Cannot transfer more than available source stock
2. Cannot restock more than available hotel stock
3. Cannot consume more than available minibar stock
4. All stock movements are atomic (transaction-based)
5. Automatic rollback on any failure

### Error Handling
- Clear error messages for insufficient stock
- Fallback to basic consumption if stock integration fails
- Frontend validation before API calls
- User-friendly error display

## Benefits of New System

### 1. Complete Audit Trail
- Every stock movement is recorded
- Traceability from supplier to guest consumption
- Reconciliation between physical and system stock

### 2. Professional Inventory Management
- Centralized stock control
- Location-based tracking
- Real-time stock visibility

### 3. Automated Alerts
- Proactive low stock notifications
- Prevents stockouts
- Improves guest experience

### 4. Flexible Stock Sources
- Transfer from Restaurant or Bar
- Central Hotel stock location
- Easy stock redistribution

### 5. Data Integrity
- Transaction-based operations
- Automatic rollback on failures
- Consistent state across all tables

## Migration Notes

### Database Migration
Run the migration to add Hotel location:
```sql
INSERT INTO `stock_locations` (`id`, `nom`) VALUES (5, 'Hotel');
```

### Service Updates
- Updated `minibar.service.ts` with stock integration methods
- Updated `consumption.service.ts` to use stock-integrated consumption
- Created new `stock.service.ts` for stock management
- Updated components to use new stock transfer functionality

## Troubleshooting

### Common Issues

**Stock Not Updating**
- Check if Hotel location (id=5) exists in stock_locations
- Verify stock movement records in stock_movements table
- Check for transaction failures in backend logs

**Low Stock Alerts Not Working**
- Verify seuil_alerte values in room_minibar table
- Check frontend periodic check interval
- Review notification service integration

**Transfer Failures**
- Verify source location has sufficient stock
- Check product exists in both source and products table
- Review network connectivity and API responses

## Future Enhancements

### Potential Improvements
1. **Automatic Purchase Orders**: Generate POs when hotel stock is low
2. **Barcoded Scanning**: Mobile app for physical stock verification
3. **Predictive Analytics**: AI-based consumption forecasting
4. **Multi-location Support**: Different hotel wings/floors
5. **Batch Operations**: Bulk transfers and restocking

## Support

For issues or questions:
1. Check this documentation first
2. Review API response messages
3. Check database tables for data consistency
4. Review browser console for frontend errors
5. Check backend logs for server errors

---

**Last Updated**: 2025-01-13  
**Version**: 2.0 (Professional Stock Integration)  
**Author**: Senior Developer