# Sources on slope, irradiation weighting and thresholds for ground-mounted PV

Collected on 2026-09-28 for `docs/domain/decision-memo-pv-method.md`. Each quote below was
checked in the source document itself unless it is marked **not verified**.

## German guidance

- **Regionalverband Bodensee-Oberschwaben, *Kriterienkatalog – Vorbehaltsgebiete Photovoltaik* (21.12.2023), pp. 3–4**
  - URL: https://www.rvbo-energie.de/media/pages/home/0c11be2a35-1706771328/handout-kriterienkatalog-vorbehaltsgebiete-photovoltaik.pdf
  - Slope: "Flächen mit einer Neigung von 15 bis < 25 % als Konflikt und Flächen mit einer Neigung von ≥ 25 % als erheblicher Konflikt eingestuft."
  - Aspect, applied at a slope of 3–25 %:
    - south: "Hohe Eignung"
    - east and west: "Eignung"
    - north-east and north-west: "Konflikt"
    - north: "Erheblicher Konflikt"
  - Irradiation: "> 1.150 kWh/qm" is rated "Eignung".
  - The catalogue uses ordinal classes and no numeric weights.
- **Öko-Institut (Kohler/Wingenbach), *Potenzialflächen für Agri-Photovoltaik* (March 2024), pp. 15 and 17**
  - URL: https://www.oeko.de/fileadmin/oekodoc/Potenzialflaechen_fuer_Agri-Photovoltaik.pdf
  - "alle Flächen mit einer gemittelten Hangneigung, die größer als 20 % ist, [werden] aus der Kulisse ausgeschlossen" (agri-PV).
- **LUBW Energieatlas BW, *Grundlagen* (ground-mounted PV)**
  - URL: https://www.energieatlas-bw.de/sonne/freiflaechen/grundlagen
  - There is no slope cut-off. The mean "Hangneigung in Prozent" is only reported, computed from a 5 m DGM.
  - The landfill sub-study says: "Böschungsneigungen über 21° … werden nicht berücksichtigt".
- **Bayern StMB, *Rundschreiben* on ground-mounted PV (10.12.2021), PDF p. 43**
  - URL: https://www.stmb.bayern.de/assets/stmi/buw/baurechtundtechnik/25_rundschreiben_freiflaechen-photovoltaik.pdf
  - Lists "Geländerücken, Kuppen und Hanglagen" under "Eingeschränkt geeignete Standorte". It gives no number.
- **Brandenburg MLUK/MIL/MWAE, *Gemeinsame Arbeitshilfe PV-FFA* (August 2023), p. 21**
  - URL: https://mleuv.brandenburg.de/sixcms/media.php/9/Gemeinsame-Arbeitshilfe-PV-FFA.pdf
  - "So ist zum Beispiel eine Nutzung von Hängen zu vermeiden." It gives no number, and the reason is the landscape.
  - The MLUK *Handlungsempfehlung* of 2021 (p. 7) uses the same wording.
- **UBA, *Umweltverträgliche Standortsteuerung von Solar-Freiflächenanlagen* (August 2022), PDF p. 51**
  - URL: https://www.uba.de/system/files/medien/479/publikationen/uba_umweltvertraegliche_standortsteuerung_von_solar-freiflaechenanlagen.pdf
  - "Hanglagen können je nach Ausrichtung aus energietechnischer Sicht von Vorteil sein, doch die exponierte Lage am Hang kann … zu … visuellen negativen Veränderungen führen". It gives no number.
- **Fraunhofer ISE, *Aktuelle Fakten zur Photovoltaik* (version 20.8.2026)**
  - It has no terrain-slope criterion. It gives only the module tilt: "Neigung von 20° - 25° zur Horizontalen" (p. 38).
- **Not verified:**
  - Baden-Württemberg UM, *Hinweise zum Ausbau von PV-Freiflächenanlagen*: the PDF is scanned images with no extractable text.
  - Schleswig-Holstein *Solar-Erlass* (09.09.2024): the server did not respond.

## Peer-reviewed

- **Ryberg, Robinius, Stolten 2018, *Energies* 11:1246, Table 2**
  - URL: https://doi.org/10.3390/en11051246
  - A review of 53 land-eligibility studies, wind and PV mixed. 68 % of them use slope, and the typical rule excludes "above 10°".
- **Tröndle, Pfenninger, Lilliestam 2019, *Energy Strategy Reviews* 26**
  - URL: https://timtroendle.github.io/possibility-for-electricity-autarky/
  - Open-field PV "with slope below 10°".
- **Durlević et al. 2026, *Clean Technologies* 8:99**
  - URL: https://doi.org/10.3390/cleantechnol8040099
  - Fuzzy-AHP weights: PV output 0.179, terrain slope 0.120.
  - Slope scores: 0–5° = 5, 5–10° = 4, 10–15° = 3, 15–20° = 2, above 20° = 1. Slope is scored, never excluded.
  - The output is in classes, on a 100 m EU-DEM.
- **Kowalczyk & Czyża 2022, *Energies* 15:6693**
  - URL: https://doi.org/10.3390/en15186693
  - "there are no strict guidelines regarding the land inclination".
  - The mean slope of 555 existing PV farms is 1.37° (1 m LiDAR).

## Resolution

- **Grohmann 2015, *Computers & Geosciences* 77:111–117**
  - URL: https://eartharxiv.org/repository/view/1620/
  - "slope will systematically reduce as the resolution becomes coarser".
  - "Using a low resolution DEM for regional scale morphometric analysis is not an optimal choice".
- **Not verified:** Kienzle 2004, *Transactions in GIS*, reports an optimum of 5–20 m. This comes from a search snippet only; the PDF returned 403.
