# Interactive Rectangle Chart API Documentation

This document describes how to interact with the interactive rectangle chart component programmatically, assuming access to the `chart` object exposed in the global scope (e.g., `window.chart`).

## Core Data Structures

### `EntryData`

Represents a single key-value entry within a rectangle. Each entry has a unique ID.

```typescript
interface EntryData {
  id: string;    // Unique identifier (UUID) for this entry
  left: string;  // Text displayed on the left side
  right: string; // Text displayed on the right side
}
```

### `RectData`

Represents the data content of a single rectangle.

```typescript
interface RectData {
  title: string;       // The title displayed at the top of the rectangle
  entries: EntryData[]; // An array of entries within the rectangle
}
```

### `Endpoint`

Defines one end of a connection. It can point to an entire rectangle or a specific entry within a rectangle.

```typescript
interface Endpoint {
  rectId: string;  // The ID of the target rectangle
  entryId?: string; // Optional: The ID of a specific entry within the rectangle
}
```

### `Connection`

Represents a connection between two endpoints. Connections are bidirectional visually but have distinct `sideA` and `sideB` endpoints in the data structure.

```typescript
interface Connection {
  id: string;    // Unique identifier (UUID) for the connection
  sideA: Endpoint; // The first endpoint
  sideB: Endpoint; // The second endpoint
}
```

## Interacting with the Chart (`chart` object)

### Rectangles

**1. Add a Rectangle**

Creates a new rectangle with the provided data and adds it to the chart at a random position.

```javascript
// Example usage:
const newData = {
  title: "New Node",
  entries: [
    { id: crypto.randomUUID(), left: "Key1", right: "Value1" },
    { id: crypto.randomUUID(), left: "Key2", right: "Value2" }
  ]
};
const newRectId = chart.addRectangle(newData);
console.log("Added rectangle with ID:", newRectId);
chart.draw(); // Redraw to see the new rectangle
```

*   **Method:** `addRectangle(data: RectData): string`
*   **Parameters:**
    *   `data`: A `RectData` object containing the title and entries for the new rectangle. Ensure `EntryData` objects within the `entries` array have unique `id`s (use `crypto.randomUUID()`).
*   **Returns:** The unique `id` (string) assigned to the newly created rectangle.

**2. Remove a Rectangle**

Removes a rectangle and any connections attached to it or its entries from the chart.

```javascript
// Example usage:
const success = chart.removeRectangle(existingRectId);
if (success) {
  console.log("Rectangle removed.");
  chart.draw(); // Redraw to reflect the removal
} else {
  console.log("Rectangle not found.");
}
```

*   **Method:** `removeRectangle(id: string): boolean`
*   **Parameters:**
    *   `id`: The unique ID of the rectangle to remove.
*   **Returns:** `true` if the rectangle was found and removed, `false` otherwise.
    *   *Note:* The current implementation of `removeRectangle` in `foo.ts` does not automatically remove associated connections. This needs to be updated for full consistency.

**3. Update Rectangle Data**

Replaces the data (title and entries) of an existing rectangle. This is useful for renaming the title, adding/removing/reordering entries, or changing entry text.

```javascript
// Example usage: updating title and adding an entry
const updatedData = {
  title: "Updated Node Title",
  entries: [
    // Keep existing entries (ensure IDs are preserved if needed)
    { id: existingEntryId1, left: "Key1", right: "Value1 Updated" },
    { id: existingEntryId2, left: "Key2", right: "Value2" },
    // Add a new entry
    { id: crypto.randomUUID(), left: "New Key", right: "New Value" }
  ]
};
const success = chart.updateRectangle(existingRectId, updatedData);
if (success) {
  console.log("Rectangle updated.");
  chart.draw(); // Redraw to see changes
} else {
  console.log("Rectangle not found.");
}
```

*   **Method:** `updateRectangle(id: string, data: RectData): boolean`
*   **Parameters:**
    *   `id`: The ID of the rectangle to update.
    *   `data`: A `RectData` object with the new title and complete list of entries.
        *   **Important:** To modify entries, provide the *full new array* of `EntryData` objects. Preserve existing `id`s for entries you want to keep/modify. New entries need new unique `id`s. Entries not included in the new array will be implicitly removed.
        *   *Note:* The current implementation of `updateRectangle` in `foo.ts` does not automatically remove connections associated with removed entries. This needs to be updated.
*   **Returns:** `true` if the rectangle was found and updated, `false` otherwise.

### Connections

**1. Add a Connection**

Creates a connection between two specified endpoints (rectangles or entries).

```javascript
// Example: Connect entry1 of rect1 to the whole of rect2
const connectionId = chart.addConnection(
  { rectId: rectId1, entryId: entryId1 }, // Side A: Specific entry
  { rectId: rectId2 }                     // Side B: Whole rectangle
);
console.log("Added connection with ID:", connectionId);
chart.draw(); // Redraw to see the connection
```

*   **Method:** `addConnection(sideA: Endpoint, sideB: Endpoint): string`
*   **Parameters:**
    *   `sideA`: An `Endpoint` object for the first connection point.
    *   `sideB`: An `Endpoint` object for the second connection point.
*   **Returns:** The unique `id` (string) assigned to the newly created connection.

**2. Remove a Connection**

Removes a specific connection by its ID.

```javascript
// Example usage:
const success = chart.removeConnection(existingConnectionId);
if (success) {
  console.log("Connection removed.");
  chart.draw(); // Redraw to reflect removal
} else {
  console.log("Connection not found.");
}
```

*   **Method:** `removeConnection(id: string): boolean`
*   **Parameters:**
    *   `id`: The unique ID of the connection to remove.
*   **Returns:** `true` if the connection was found and removed, `false` otherwise.

**3. Get All Connections**

Retrieves a list of all current connections.

```javascript
// Example usage:
const allConnections = chart.getConnections();
console.log("All connections:", allConnections);
```

*   **Method:** `getConnections(): Connection[]`
*   **Returns:** An array containing all `Connection` objects currently in the chart.

**4. Get Connections for a Specific Rectangle**

Retrieves all connections where the given rectangle (or one of its entries) is an endpoint.

```javascript
// Example usage:
const connectionsForRect = chart.getConnectionsForRect(rectId1);
console.log(`Connections involving rectangle ${rectId1}:`, connectionsForRect);
```

*   **Method:** `getConnectionsForRect(rectId: string): Connection[]`
*   **Parameters:**
    *   `rectId`: The ID of the rectangle to query.
*   **Returns:** An array of `Connection` objects associated with the specified rectangle.

## Redrawing

After making any changes (adding/removing/updating rectangles or connections), call `chart.draw()` to visually update the canvas.

```javascript
chart.draw();
```
