export const OFFICE_WAYPOINTS = {
    lobby: { x: 120, y: 120 },
    directorDesk: { x: 260, y: 110 },
    managerDeskA: { x: 320, y: 200 },
    managerDeskB: { x: 240, y: 230 },
    specialistPodA: { x: 390, y: 280 },
    specialistPodB: { x: 455, y: 260 },
    meetingRoom: { x: 170, y: 300 },
    waitingArea: { x: 90, y: 280 },
    breakArea: { x: 510, y: 160 }
};
export function waypointForTaskStatus(status) {
    switch (status) {
        case "QUEUED":
        case "ASSIGNED":
            return "meetingRoom";
        case "IN_PROGRESS":
            return "specialistPodA";
        case "BLOCKED":
            return "waitingArea";
        case "PENDING_APPROVAL":
            return "managerDeskA";
        case "DONE":
            return "breakArea";
        case "FAILED":
            return "waitingArea";
        case "CANCELLED":
            return "lobby";
        default:
            return "lobby";
    }
}
export function getWaypoint(name) {
    return OFFICE_WAYPOINTS[name];
}
