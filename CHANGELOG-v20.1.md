# MR FieldBook Practical v20.1

- Removed numeric stockist/company-code prefixes such as `1001556:` from chemist names.
- Preserves the removed numeric value internally as `stockistCode` for reporting/reference.
- Applies cleanup during backup restore, state migration, embedded seed load and future spreadsheet imports.
- Cleans saved chemist-name references in doctor, visit, order and voice-capture data where applicable.
- No doctor, chemist, visit, GPS, timing, POB or historical records are intentionally deleted.
