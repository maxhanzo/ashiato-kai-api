# Geolocation sources and terms

## Boundary conversion: piuccio/open-data-jp-prefectures-geojson

Source: https://github.com/piuccio/open-data-jp-prefectures-geojson
Pinned revision: `513fb852832c99470e16b95a30ddd68bf3469dc0`.
Input: `output/prefectures.geojson`.
SHA-256: `c12ec2656d13fe9c59237e742274fbc072e6b4a540de3cc41d432042aef7bace`.

The upstream repository supplies this notice, reproduced in full:

```text
The MIT License (MIT)
Copyright (c) 2019 Fabio Crisci

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
OR OTHER DEALINGS IN THE SOFTWARE.

```

## Underlying administrative boundaries: MLIT / GSI

Source: Ministry of Land, Infrastructure, Transport and Tourism (MLIT), National
Land Numerical Information, Administrative Area Data, 2019-01-01
(`N03-19_190101`), itself based on GSI administrative-area mapping.

- Dataset: https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-v2_3.html
- Terms: https://nlftp.mlit.go.jp/ksj/other/agreement.html

MLIT identifies the relevant 2018-fiscal-year-and-later data as open data under
its applicable terms. Its current site terms refer to the Public Data License
1.0 and require source credit and identification of modifications. The upstream
MIT notice does not replace the underlying government-data terms.

Ashiato Kai cleans geometry, simplifies boundaries, splits prefectures into
assets and adds names, markers and camera bounds. This derivative was not
produced or endorsed by MLIT or GSI. Retain the source links and modification
notice when distributing these assets.

## Capital marker coordinates: GSI

Source: Geospatial Information Authority of Japan (GSI), prefecture representative
points returned by its map address-search service, retrieved 2026-10-04.
Each selected response and request URL is recorded in
`geodata/capital-source-snapshot.json`. Names and coordinates are combined in
`geodata/prefectures.json`.

- GSI Maps: https://maps.gsi.go.jp/
- Content terms: https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html
- Capital-name cross-check: Statistics Bureau, Administrative Map of Japan:
  https://www.stat.go.jp/english/data/handbook/pdf/shjmap_a.pdf

Suggested visible credit:

> Boundaries: MLIT National Land Numerical Information (2019), via Fabio Crisci.
> Capital locations: GSI. Simplified and adapted by Ashiato Kai.

These are approximate display positions and simplified modern reference maps,
not historical boundaries or survey products. Code and immigration-record
rights are separate from these geography source notices. Preserve Apple's own
basemap attribution when displaying the data over MapKit maps.

## Historical-region reference geometry

`public/geolocation/karafuto.geojson`, `public/geolocation/korea.geojson`, and `geodata/historical-regions-source.geojson` use geometry derived from Natural Earth. Natural Earth raster and vector data are public domain and permit modification and redistribution.

- Source: https://www.naturalearthdata.com/
- Terms: https://www.naturalearthdata.com/about/terms-of-use/

Karafuto's northern historical limit is represented at 50° N on the basis of Article IX of the 1905 Treaty of Portsmouth. The generated asset is a reference map at Natural Earth's source scale; small adjacent islands may be omitted. Korea is represented by a dissolved peninsula outline with the modern North/South boundary removed. Neither asset is intended to assert present-day sovereignty or borders.
