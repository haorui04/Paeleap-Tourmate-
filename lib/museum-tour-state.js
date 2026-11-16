export const ENTRANCE = [0, 0, 5];

/** Virtual gallery positions, independent of any claim about the museum floor plan. */
export function tourWaypoint(index) {
  return [index % 2 === 0 ? -2.1 : 2.1, 0, -2 - index * 4.2];
}

export function initialTourState() {
  return { phase: "welcome", currentArtifactIndex: -1, targetIndex: null, motionId: 0 };
}

export function tourReducer(state, action) {
  switch (action.type) {
    case "NEXT": {
      if (state.phase === "moving" || state.phase === "complete") return state;
      const next = state.currentArtifactIndex + 1;
      if (next >= action.count) return { ...state, phase: "complete", targetIndex: null };
      return { ...state, phase: "moving", targetIndex: next, motionId: state.motionId + 1 };
    }
    case "LANDED":
      if (state.phase !== "moving" || action.motionId !== state.motionId) return state;
      return { ...state, phase: "artifact", currentArtifactIndex: state.targetIndex, targetIndex: null };
    case "RESET": return initialTourState();
    default: return state;
  }
}
