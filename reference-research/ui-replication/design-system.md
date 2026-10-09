# Measured Wilco LIS visual system

## 2. Extracted visual system

| Property | Observed reference value |
| --- | --- |
| Body background | `#e8ecf2` |
| Body text | `#515151` |
| Header | White, 60px high |
| Sidebar | `#2e3e4e`, collapsed 60px, expanded 220px |
| Sidebar darker selection surface | `#253544` |
| Content inset | 10px horizontally, typical panel starts at y=90px |
| Panel heading | 50px high, 19px regular heading, 20px horizontal padding |
| Body/table type | 13px, line-height approximately 1.42857 |
| Body CSS family | Roboto, Open Sans, Verdana, sans-serif |
| Heading CSS family | Roboto Slab, Open Sans, Arial, sans-serif |
| Inputs/selects | Mostly 30px high, 14px text, white, `#ccc` border, 4px radius |
| Buttons | Mostly 34px high, 14px regular text, 12px horizontal padding |
| Default textarea | 54px; reference display about 90px |
| Table heading | Approximately 28px high, `#f5f5f5`, bold 13px, 4px cell padding |
| Table rows | Approximately 28px for simple rows; taller when content wraps |
| Dashboard tiles | 120px high |
| Dashboard bill panels | Approximately 407px high |
| Reference mapping dialog | 1100 × 670px at desktop viewport |
| Parameter controls | 234px wide; row pitch 39px |
| Master control widths | Page dependent: approximately 215–297px |
| Report selection lists | Generated Bills about 150px high |

Font asset inspection did not show loaded Roboto/Open Sans/Roboto Slab files; it showed FontAwesome. The implementation follows the measured CSS family stacks and available fallbacks. Exact rendered font identity is NOT VERIFIED. Existing local Geist assets and their license were preserved; no new build-time font download was introduced.


Implementation and limitations: see ../../reports/ui-replication.md. Values were measured in the browser; they do not prescribe changes to business logic.

