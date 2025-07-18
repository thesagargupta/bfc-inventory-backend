# Google Sheets Structure Example

## How the new dynamic date columns work:

### Example Sheet Layout:
```
| Category  | Item           | 2025-07-15 (Kg) | 2025-07-16 (Kg) | 2025-07-17 (Kg) |
|-----------|----------------|------------------|------------------|------------------|
| Dairy     | Milk           | 5                | 7                | 6                |
| Dairy     | Low Fat Butter | 2                |                  | 3                |
| Dairy     | CREAM          |                  | 1                |                  |
| Poultry   | Eggs           | 10               | 12               | 15               |
| Poultry   | FISH           | 3                | 4                | 2                |
| Bakery    | Brown Bread    | 8                |                  | 10               |
```

### Daily Rolling Process:

**Day 1 (2025-07-15):**
- Column structure: Category | Item | 2025-07-15 (Kg) | | |
- Only today's data is stored

**Day 2 (2025-07-16):**
- Column structure: Category | Item | 2025-07-15 (Kg) | 2025-07-16 (Kg) | |
- Yesterday's data remains, today's data is added

**Day 3 (2025-07-17):**
- Column structure: Category | Item | 2025-07-15 (Kg) | 2025-07-16 (Kg) | 2025-07-17 (Kg) |
- All 3 days of data are present

**Day 4 (2025-07-18):**
- Column structure: Category | Item | 2025-07-16 (Kg) | 2025-07-17 (Kg) | 2025-07-18 (Kg) |
- 2025-07-15 data is automatically removed
- Columns shift left, new date column added for today

### Benefits:
1. **Clear Date Visibility**: Each column shows exactly which date the data is for
2. **Professional Layout**: Easy to read and understand
3. **Automatic Cleanup**: Old data is automatically removed after 3 days
4. **Fixed Item Structure**: All items always present in the same order
5. **Efficient Storage**: Only stores last 3 days of data