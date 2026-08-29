# RAILOPT-X 2.0 — Visual & Audio Asset Inventory & Pipeline
**SIH Problem Statement PS-25022: Intelligent Real-Time Train Traffic Controller & Digital Twin**

---

## 1. 3D & 2D Rolling-Stock Models (`src/visual/Train3DModel.ts`, `public/models/manifest.json`)

Every train in RAILOPT-X is rendered through an authentic 3-Level-of-Detail (LOD) pipeline. For Micro zoom (<40 km focus), hardware-accelerated Three.js WebGL geometry renders full consist profiles with spotlights, bogies, and pantographs. When WebGL is unavailable or reduced-motion is active, the system automatically falls back to class-specific 2D SVG consists (`StylizedRollingStock.tsx`).

| Consist Profile | Target Class | 3D Visual Mesh Features | Polycount | Materials / Shaders | LOD 0 (Macro >150km) | LOD 1 (Meso 40–150km) | LOD 2 (Micro <40km) | License | Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Vande Bharat Express** | `EXPRESS_HIGH_SPEED` | Aerodynamic nose cone, continuous window band, bogie sideframes, headlamp spotlights | 2,840 | `Aluminium_White`, `Metallic_Blue`, `Tinted_Glass` | Directional Amber Pip (● T22436) | Directional Slug with chevron & speed tag | Full 3D 16-car EMU rake with headlight spotlight | MIT / CC0 | 2D SVG |
| **WAP-7 Express** | `EXPRESS_PASSENGER` | Dual-cab electric locomotive, twin pantographs, LHB blue coaches, steel journal boxes | 3,420 | `IR_Crimson_Red`, `LHB_Blue`, `Steel_Journals` | Directional Blue Pip (● T12301) | Directional Slug with speed tag | Full 3D WAP-7 + 24 LHB coaches & pantograph | MIT / CC0 | 2D SVG |
| **WAG-9 Heavy Freight** | `HEAVY_FREIGHT` | Heavy industrial cab, container wagons with twistlocks, cast iron couplers | 4,150 | `Forest_Green`, `Container_Orange`, `Cast_Iron` | Directional Teal Pip (● T04403) | High-vis chevron slug with tonnage | Full 3D WAG-9 + 42 container flatcars | MIT / CC0 | 2D SVG |
| **MEMU Commuter** | `SUBURBAN_COMMUTER`| Suburban commuter cab, wide sliding passenger doors, rooftop resistor grid | 2,100 | `Commuter_Purple`, `Aluminium_Doors` | Directional Purple Pip (● T64501) | Commuter rake slug | Full 3D 12-car MEMU commuter consist | MIT / CC0 | 2D SVG |

---

## 2. Track & Infrastructure Topology Geometry (`src/visual/RailTopology.ts`)

- **Continuous Track Geometry**: Centerlines, grade profiles, and turnout geometry derived directly from backend network graph.
- **Aspect Signals**: 4-aspect signal heads (`GREEN`, `DOUBLE_YELLOW`, `YELLOW`, `RED`) dynamically computed from interlocking block occupancy.
- **Station Loops**: Continuous Cubic Bézier switch curves connecting mainline approaches to station loops (`NDLS Loop 1`, `GZB Loop 1`, `ALJN Loop 1`, `TDL Loop 1`, `ETW Loop 1`, `CNB Loop 1`).
- **Route Reservations**: Active path highlighting with color-coded reservation status and locked turnout positions.

---

## 3. Authentic Audio Stems (`public/audio/`, `src/audio/RailwayAudioEngine.ts`)

All audio stems are lightweight, clean, and CC0/MIT licensed. No persistent buzzing or artificial tones are used; audio is opt-in (muted by default) and modulated strictly by physical motion and interlocking events.

| Audio Asset File | Bus | Format / Sample Rate | Physical Trigger & Modulation | License / Attribution |
| :--- | :--- | :--- | :--- | :--- |
| `train-express-loop.ogg` | `TRAIN` | OGG / 44.1 kHz, 16-bit | Modulated by express train speed ($v / 130\,\text{km/h}$) and distance | MIT / CC0-1.0 |
| `train-freight-loop.ogg` | `TRAIN` | OGG / 44.1 kHz, 16-bit | Heavy rumble & periodic wheel clicks for freight trains | MIT / CC0-1.0 |
| `train-memu-loop.ogg` | `TRAIN` | OGG / 44.1 kHz, 16-bit | High-frequency traction inverter hum for commuter rakes | MIT / CC0-1.0 |
| `train-passenger-loop.ogg`| `TRAIN` | OGG / 44.1 kHz, 16-bit | Smooth rail rolling loop for standard passenger services | MIT / CC0-1.0 |
| `relay-click.ogg` | `INFRASTRUCTURE` | OGG / 44.1 kHz, 16-bit | 35ms mechanical impulse on signal aspect change | MIT / CC0-1.0 |
| `route-lock.ogg` | `INFRASTRUCTURE` | OGG / 44.1 kHz, 16-bit | 250ms turnout point machine latching sound | MIT / CC0-1.0 |
| `controller-alert.ogg` | `ALERT` | OGG / 44.1 kHz, 16-bit | Soft 440 Hz / 880 Hz chime on conflict radar detection | MIT / CC0-1.0 |
| `teleprinter.ogg` | `AUDIT` | OGG / 44.1 kHz, 16-bit | 30ms mechanical typewriter stroke on cryptographic audit events | MIT / CC0-1.0 |
