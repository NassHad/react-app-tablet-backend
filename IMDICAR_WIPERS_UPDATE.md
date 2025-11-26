# IMDICAR Wipers Positions - Frontend Update Summary

## Overview

Successfully imported and updated IMDICAR wiper positions data into the `wipersProduct` table. All positions now include complete information with size, description, brand, and reference codes.

## What Was Implemented

### Data Import
- **Source**: `Liste affectations BEG PLATS IMDICAR_200825.csv` (2,431 vehicle records)
- **Status**: 489 wipers products successfully updated with IMDICAR positions
- **Reference Matching**: 1,081 positions matched with IMDICAR product references

### Data Structure Updates

The `wipersPositions` JSON array in `wipersProduct` now includes IMDICAR positions with the following structure:

```json
{
  "wipersPositions": [
    {
      "position": "Driver",
      "size": "600mm",
      "description": "BEG PLAT 600MM 24''",
      "brand": "Imdicar",
      "ref": "487"
    },
    {
      "position": "Passenger",
      "size": "340mm",
      "description": "BEG PLAT 340MM 13''",
      "brand": "Imdicar",
      "ref": null  // If no matching ref found (size too small)
    },
    {
      "position": "Back",
      "size": "290mm",
      "description": "BEG PLAT 290MM 11''",
      "brand": "Imdicar",
      "ref": null  // If no matching ref found
    }
  ]
}
```

### Position Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `position` | string | Position name | `"Driver"`, `"Passenger"`, `"Back"` |
| `size` | string | Size in millimeters | `"600mm"`, `"340mm"` |
| `description` | string | Full description with size | `"BEG PLAT 600MM 24''"` |
| `brand` | string | Wiper brand | `"Imdicar"` |
| `ref` | string \| null | Product reference code | `"487"` (from wiper-data table) |

### Reference Matching Logic

The `ref` field links to the `wiper-data` table:
- **Matching**: Finds the closest IMDICAR wiper-data size that is **≤ position size** (never greater)
- **Example**: Position with 600mm → Matches REF "487" (600MM)
- **Unmatched**: Positions with sizes < 350mm cannot be matched (IMDICAR minimum size is 350MM)

## API Usage

### Existing Endpoints

The existing wipers-selection API endpoints work with the updated data:

#### Get Positions by Model
```
GET /api/wipers-selection/positions/:modelId
```

**Response includes IMDICAR positions:**
```json
[
  {
    "id": "pos-0",
    "name": "Driver",
    "slug": "driver",
    "isActive": true,
    "ref": "487",
    "category": null
  },
  {
    "id": "pos-1",
    "name": "Passenger",
    "slug": "passenger",
    "isActive": true,
    "ref": null,
    "category": null
  }
]
```

#### Get Wiper Data by Position
```
GET /api/wipers-selection/wiper-data/:positionId
```

Returns position data including the `ref` field which can be used to fetch detailed product information from the `wiper-data` table.

### Fetching Detailed Product Info

To get full product details (images, GTI codes, etc.) using the `ref`:

```
GET /api/wipers-data?filters[ref][$eq]=487
```

## Data Statistics

### Import Results
- **Total CSV rows processed**: 2,285
- **Products updated**: 489
- **Positions added**: 1,237
- **Positions with ref matched**: 1,081
- **Positions without ref** (sizes < 350mm): 156

### Available IMDICAR Sizes

IMDICAR wiper-data sizes available in the system:
- 350MM (REF: 480)
- 400MM (REF: 481)
- 450MM (REF: 482)
- 480MM (REF: 483)
- 500MM (REF: 484)
- 530MM (REF: 485)
- 550MM (REF: 486)
- 600MM (REF: 487)
- 650MM (REF: 488)
- 700MM (REF: 489)

## Frontend Implementation Notes

### 1. Displaying Positions

When displaying wiper positions, check for the `ref` field:

```typescript
// Example: Display position with product reference
const position = wipersPositions[0];

if (position.ref) {
  // Has valid reference - can fetch full product details
  const productDetails = await fetch(`/api/wipers-data?filters[ref][$eq]=${position.ref}`);
} else {
  // No reference - position size too small for available IMDICAR products
  // Show position info but indicate product details unavailable
}
```

### 2. Filtering Positions

Filter positions by brand if needed:

```typescript
const imdicarPositions = wipersPositions.filter(
  pos => pos.brand === 'Imdicar'
);

const otherBrandPositions = wipersPositions.filter(
  pos => pos.brand !== 'Imdicar'
);
```

### 3. Size Display

The `size` and `description` fields provide different formats:

```typescript
// Size: Simple format
position.size // "600mm"

// Description: Full format with inches
position.description // "BEG PLAT 600MM 24''"
```

### 4. Handling Missing References

Positions without `ref` (null) typically have sizes < 350mm:
- Show position information (size, description)
- Display a message indicating product details unavailable
- Log for manual review if needed

## Example: Complete Position Object

```json
{
  "position": "Driver",
  "size": "600mm",
  "description": "BEG PLAT 600MM 24''",
  "brand": "Imdicar",
  "ref": "487"
}
```

When `ref` is present, you can:
1. Fetch product details: `GET /api/wipers-data?filters[ref][$eq]=487`
2. Display product images, GTI codes, barcodes, etc.
3. Show complete product information to users

## Migration Notes

- **No breaking changes**: Existing API endpoints continue to work
- **New fields**: `size`, `description`, and `brand` added to positions
- **Enhanced data**: `ref` field now populated for most IMDICAR positions
- **Backward compatible**: Positions without new fields still function

## Files Reference

- **Import script**: `scripts/import-imdicar-wipers-positions.js`
- **Ref update script**: `scripts/update-imdicar-position-refs.js`
- **Import log**: `scripts/import-imdicar-log.json`
- **Ref update log**: `scripts/update-imdicar-refs-log.json`

## Questions or Issues?

If you encounter any issues with the IMDICAR positions data:
1. Check the log files for unmatched positions
2. Verify the `ref` field exists before fetching product details
3. Handle null `ref` values gracefully in the UI

