# Nowcasting Website

This is the marketing website for Nowcasting, hosted at [nowcasting.io](nowcasting.io).

## Getting Started

First, run the development server:

```bash
yarn install
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Flowchart of the NOWCASTING data model

```mermaid
flowchart LR
    id1(PV)-->id5(Nowcasting)
    id2("Satellite Imagery")-->id5(Nowcasting)
    id3("Weather Model Outputs")-->id5(Nowcasting)
    id4("Topographic Data")-->id5(Nowcasting)
    id5(Nowcasting)-->id6("PV & Cloud Forecasts")
    classDef default fill:#FFC629,stroke:#FFC629,stroke-width:2px;
```
