import React from "react";
import { HappinessCirclesView } from "./HappinessCirclesView";
import { CountryRow } from "./types";

// Assume countries: CountryRow[] is provided by parent or context
// Replace this with your actual data import or prop
import countries from "../World-happiness-report-2024.json";

export default function App() {
  return <HappinessCirclesView countries={countries} />;
}
