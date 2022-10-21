const preferredTimes = [
  "9:00PM",
  "9:15PM",
  "9:30PM",
  "8:15",
  "8:30",
  "8:45",
  "9:45PM",
  "10:00PM",
];

export function getPreferredReservation(
  allReservations: any[],
  TYPE_FILTER: string,
  RECON_MODE: boolean
) {
  // No reservations available -> preffered res is always undefined
  if (allReservations.length === 0) {
    return undefined;
  }

  // Debug
  console.log(`TYPE_FILTER: ${TYPE_FILTER}`);
  console.log(`TYPE_FILTER_EMPTY: ${String(TYPE_FILTER === "")}`);

  // Filter based on TYPE_FILTER env var
  // Only filter if TYPE_FILTER is present
  let matchesTypePreference = allReservations;
  if (TYPE_FILTER) {
    matchesTypePreference = allReservations.filter(
      (r) => r.type === TYPE_FILTER
    );
  }

  // Find the preferred reservation
  let preferredReservation: any = undefined;
  preferredTimes.forEach((t) => {
    if (preferredReservation !== undefined) {
      return;
    }
    preferredReservation = matchesTypePreference.find((r) => r.time === t);
  });

  // No reservations available -> preffered res is always undefined
  if (preferredReservation === undefined) {
    console.log("No preferred reservation found");
    // Return first option in recon mode
    if (RECON_MODE) {
      console.log("RECON MODE - Return first available");
      return allReservations[0];
    }

    return undefined;
  }

  // Return preferred reservation
  return preferredReservation;
}
