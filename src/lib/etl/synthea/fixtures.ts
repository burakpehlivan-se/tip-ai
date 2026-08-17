import { SyntheaEpisodeBundle } from "./types";

/** Pnömonili sentetik hasta — test fixture. */
export function pneumoniaBundle(): SyntheaEpisodeBundle {
  const obs = (code: string, value: string) => ({
    id: 1,
    patientId: "p1",
    encounterId: null,
    date: new Date("2024-01-01T00:00:00Z"),
    category: "laboratory",
    code,
    description: null,
    value,
    valueNum: Number(value),
    units: null,
    type: "numeric",
  });
  return {
    source: "synthea",
    patient: {
      id: "p1",
      birthdate: new Date("1980-01-01T00:00:00Z"),
      deathdate: null,
      first: "Jane",
      last: "Doe",
      gender: "F",
      race: null,
      ethnicity: null,
      marital: null,
      city: null,
      state: null,
      zip: null,
    },
    conditions: [
      { id: 1, patientId: "p1", encounterId: null, start: null, stop: null, code: "233604007", description: "Pneumonia (disorder)" },
    ],
    observations: [
      obs("2339-0", "110"),
      obs("38483-4", "1.0"),
      obs("718-7", "13.5"),
      obs("6690-2", "14"),
      obs("1988-5", "85"),
      obs("8480-6", "124"),
      obs("8462-4", "78"),
      obs("8867-4", "96"),
      obs("8310-5", "38.4"),
      obs("2708-6", "93"),
    ],
    medications: [],
    procedures: [],
    encounters: [],
    imagingStudies: [],
  };
}
